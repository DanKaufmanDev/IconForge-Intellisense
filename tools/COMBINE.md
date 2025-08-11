# IconForge JSON Combiner (`combine.py`)

This script is a utility tool designed to streamline the process of creating icon metadata for the IconForge VS Code extension.

It scans a specified directory for Icon `.json` export files, extracts the necessary vector data and tags for each icon, and compiles them into a single, properly formatted JSON file that the IconForge extension can use.

## Prerequisites

- Python 3
- One or more Icon JSON files.

## Input Format

The script is designed to parse the standard JSON file format. It specifically looks for the `height` of the icon set and the `icons` array. Within each icon object, it uses the `tags` and `paths` arrays.

**Example Icon `selection.json` structure:**
```json
{
  "height": 1024,
  "icons": [
    {
      "properties": {
        "name": "home"
      },
      "tags": ["home", "house"],
      "paths": ["M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"]
    }
  ]
}
```

## Usage

You can run the script from the command line, optionally providing a path to the directory containing your `.json` files.

### Recommended Usage

Place all your  `.json` files into the `tools/input/` directory and run the script from the project root.

```bash
# Provide the input directory as an argument
python3 tools/combine.py tools/input/
```

### Default Usage

If you run the script without any arguments, it will scan the directory it is located in (`tools/`) for any `.json` files.

```bash
# No argument provided, scans the script's own directory
python3 tools/combine.py
```

## Output

The script will generate a single file named `output.data.json` inside the `tools/output/` directory. This file contains the combined icon data from all processed `.json` files, formatted for use by the IconForge extension.

**Example `output.data.json` content:**
```json
[
  {
    "name": "if-home",
    "paths": [
      "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"
    ],
    "viewBox": 1024
  }
]
```
