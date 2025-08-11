import os
import json
import sys

def combine_icomoon_files(input_dir, output_file):
    """
    Scans a directory for IcoMoon JSON files, extracts icon data,
    and combines it into a single JSON file for the IconForge extension.
    """
    combined_icons = []
    
    if not os.path.isdir(input_dir):
        print(f"Error: Input directory '{input_dir}' not found.")
        sys.exit(1)

    print(f"Scanning for .json files in '{input_dir}'...")

    for filename in os.listdir(input_dir):
        if filename.endswith(".json"):
            input_filepath = os.path.join(input_dir, filename)
            print(f"  -> Processing {filename}...")
            
            try:
                with open(input_filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                view_box_size = data.get("height", 1024)
                
                for icon in data.get("icons", []):
                    tags = icon.get("tags")
                    paths = icon.get("paths")
                    
                    if tags and paths:
                        # Use the first tag as the primary name
                        name = "if-" + tags[0]
                        
                        icon_data = {
                            "name": name,
                            "paths": paths,
                            "viewBox": view_box_size
                        }
                        combined_icons.append(icon_data)
            except json.JSONDecodeError:
                print(f"    Warning: Could not parse JSON from {filename}. Skipping.")
            except Exception as e:
                print(f"    Warning: An error occurred while processing {filename}: {e}. Skipping.")

    # Ensure the output directory exists
    output_dir = os.path.dirname(output_file)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Write the combined data to the output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(combined_icons, f, indent=2)

    print(f"\nSuccessfully combined {len(combined_icons)} icons into \"{output_file}\"")

if __name__ == "__main__":
    # The script expects the input directory as a command-line argument.
    # If no argument is given, it will default to the directory where the script is located.
    if len(sys.argv) > 1:
        source_dir = sys.argv[1]
    else:
        source_dir = os.path.dirname(os.path.abspath(__file__))

    # The output file will be placed in the correct data directory for the extension.
    script_root = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_root)
    output_path = os.path.join(project_root, 'tools', 'output', 'output.data.json')
    
    combine_icomoon_files(source_dir, output_path)
