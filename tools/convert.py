import json
import re
import sys
import os

def parse_css_to_json(css_text):
    results = []
    keyframes_cache = {}

    # First pass: find all keyframes and cache them
    kf_pattern = r'(@keyframes\s+(?P<name>[^\s{]+)\s*\{[^}]+\})'
    for m in re.finditer(kf_pattern, css_text, re.DOTALL):
        kf_name = m.group('name').strip()
        full_kf_rule = m.group(1).strip()
        keyframes_cache[kf_name] = full_kf_rule

    # Second pass: find all classes and associate keyframes
    cls_pattern = r'(\.(?P<name>[^\s{]+)\s*\{\s*(?P<body>[^}]+?)\s*\})'
    for m in re.finditer(cls_pattern, css_text, re.DOTALL):
        cls_name = m.group('name').strip()
        cls_body = m.group('body').strip()
        full_cls_rule = m.group(1).strip()

        # Check if this class uses an animation
        anim_match = re.search(r'animation:\s+([^\s;]+)', cls_body)
        if anim_match:
            kf_name_used = anim_match.group(1).strip()
            if kf_name_used in keyframes_cache:
                # It's an animation class, combine keyframes and class rule
                combined_snippet = f"{keyframes_cache[kf_name_used]}\n\n{full_cls_rule}"
                results.append({"name": cls_name, "snippet": combined_snippet})
                continue

        # It's a normal class, format the snippet
        decls = [d.strip() for d in cls_body.split(';') if d.strip()]
        formatted_body = ";\n  ".join(decls)
        if formatted_body:
            formatted_body += ';'
        
        snippet = f".{cls_name} {{\n  {formatted_body}\n}}"
        entry = {"name": cls_name, "snippet": snippet}
        
        # Optional: extract style info for non-animation classes
        style_pattern = r'(?:color|background-color)\s*:\s*([^;]+);?'
        style_match = re.search(style_pattern, cls_body, re.IGNORECASE)
        if style_match:
            style_val = style_match.group(1).strip()
            entry["color"] = style_val

        results.append(entry)
        
    return results

def convert_json_to_css(json_data):
    css_output = []
    # Check if json_data is a list (the format the script generates)
    if isinstance(json_data, list):
        for entry in json_data:
            if 'snippet' in entry:
                css_output.append(entry['snippet'])
            elif 'content' in entry and 'name' in entry:
                css_rule = f".{entry['name']}:before {{'\n'  content: \"{entry['content']}\";'\n}}"
                css_output.append(css_rule)
    # Check if json_data is a dictionary (the user's master format)
    elif isinstance(json_data, dict):
        for class_name, css_rule in json_data.items():
            if isinstance(css_rule, dict) and 'class' in css_rule:
                 # Handle animation objects with 'keyframes' and 'class'
                 if 'keyframes' in css_rule:
                     css_output.append(css_rule['keyframes'])
                 css_output.append(css_rule['class'])
            elif isinstance(css_rule, str):
                 css_output.append(css_rule)

    return "\n\n".join(css_output)

def main():
    args = sys.argv[1:]
    if not args or len(args) < 1:
        print(f"Usage: python3 {sys.argv[0]} path/to/file.[css|json] [--auto]")
        sys.exit(1)

    input_file = args[0]
    auto_flag = '--auto' in args
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, 'output')
    os.makedirs(output_dir, exist_ok=True)

    if input_file.endswith('.css'):
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            print(f"File '{input_file}' not found.")
            sys.exit(1)

        classes = parse_css_to_json(content)

        output_path = os.path.join(output_dir, 'output.json')
        with open(output_path, 'w', encoding='utf-8') as jf:
            json.dump(classes, jf, indent=2)
        print(f"JSON for extension metadata saved to {output_path}")

    elif input_file.endswith('.json'):
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
        except FileNotFoundError:
            print(f"File '{input_file}' not found.")
            sys.exit(1)
        except json.JSONDecodeError:
            print(f"Error decoding JSON from '{input_file}'.")
            sys.exit(1)
            
        css_content = convert_json_to_css(json_data)
        
        css_output_path = os.path.join(output_dir, 'output.css')
        with open(css_output_path, 'w', encoding='utf-8') as cf:
            cf.write(css_content)
        print(f"CSS saved to {css_output_path}")

        if auto_flag:
            print("-- Running auto-conversion back to extension JSON format --")
            final_json_data = parse_css_to_json(css_content)
            
            final_json_path = os.path.join(script_dir, '..', 'tools', 'output', 'output.json')
            os.makedirs(os.path.dirname(final_json_path), exist_ok=True)
            
            with open(final_json_path, 'w', encoding='utf-8') as jf:
                json.dump(final_json_data, jf, indent=2)
            print(f"Extension data successfully updated at: {final_json_path}")
        
    else:
        print("Input file must be a .css or .json file.")
        sys.exit(1)

if __name__ == "__main__":
    main()
