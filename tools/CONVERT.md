# CSS <=> JSON Conversion Tool (`convert.py`)

This command-line tool provides two-way conversion between CSS and a structured JSON format. It can parse a CSS file to extract its class definitions, or convert a properly structured JSON file back into a CSS stylesheet.

## Prerequisites

- Python 3

## Usage

To use the tool, run the script from your terminal, providing the path to the source file. The script will automatically detect whether to convert from CSS to JSON or vice-versa based on the file extension (`.css` or `.json`).

```bash
python3 convert.py <path_to_file.[css|json]> [--auto]
```

## Workflow Flag

- **`--auto`**: When converting from a master JSON file to CSS, this flag automates the full workflow by immediately converting the newly generated CSS back into the final JSON format. The final output is saved to `tools/output/output.json`.

## Examples

### CSS to JSON

This will parse all classes from `styles.css` and create a JSON file in the `output` directory.
```bash
python3 convert.py path/to/styles.css
```

### JSON to CSS

This will parse `data.json` and create a `output.css` file from its contents.
```bash
python3 convert.py path/to/data.json
```

### Automated Workflow (JSON -> CSS -> JSON)

This will convert `iconforge-styles.json` to CSS, and then automatically convert that CSS back into a final `output.json` in the `output` directory.
```bash
python3 convert.py path/to/iconforge-styles.json --auto
```

## Output

The script will generate a new file (`output.json` or `output.css`) inside an `output` directory.

If the `--auto` flag is used, the final generated JSON file will be named `output.json` and will also be located in the `output` directory.
