import os
import re
import json
import sys

BASE_DIR = r"e:\Projects\Notetaking App"

def run_verification():
    results = {
        "ts_types": [],
        "import_resolution": [],
        "gesture_handler": [],
        "recap_verification": [],
        "project_md_compliance": [],
        "errors": []
    }

    # 1. Validate TypeScript types in src/types/
    types_dir = os.path.join(BASE_DIR, "src", "types")
    expected_type_files = ["ai.ts", "canvas.ts", "storage.ts", "index.ts"]
    
    if os.path.exists(types_dir):
        files_in_types = os.listdir(types_dir)
        for expected in expected_type_files:
            if expected not in files_in_types:
                results["errors"].append(f"Missing expected type file: src/types/{expected}")
            else:
                filepath = os.path.join(types_dir, expected)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Check exports
                exports = re.findall(r"export\s+(?:interface|type|const|class|enum)\s+([A-Za-z0-9_]+)", content)
                reexports = re.findall(r"export\s+\*\s+from\s+['\"]([^'\"]+)['\"]", content)
                results["ts_types"].append({
                    "file": expected,
                    "exports": exports,
                    "reexports": reexports,
                    "size": len(content)
                })
    else:
        results["errors"].append("src/types directory does not exist")

    # 2. Inspect import statements across App.tsx and src/
    with open(os.path.join(BASE_DIR, "package.json"), "r", encoding="utf-8") as f:
        pkg_data = json.load(f)
    
    all_deps = set(pkg_data.get("dependencies", {}).keys()).union(set(pkg_data.get("devDependencies", {}).keys()))

    files_to_check = []
    app_tsx = os.path.join(BASE_DIR, "App.tsx")
    if os.path.exists(app_tsx):
        files_to_check.append(app_tsx)

    src_dir = os.path.join(BASE_DIR, "src")
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(".ts") or file.endswith(".tsx"):
                files_to_check.append(os.path.join(root, file))

    import_pattern = re.compile(r"import\s+(?:[\s\S]*?\s+from\s+)?['\"]([^'\"]+)['\"]")

    for filepath in files_to_check:
        rel_path = os.path.relpath(filepath, BASE_DIR)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        imports = import_pattern.findall(content)
        for imp in imports:
            # Check package vs relative vs alias
            if imp.startswith("@/"):
                # Path alias mapping to src/
                target_subpath = imp[2:] # strip @/
                possible_paths = [
                    os.path.join(src_dir, target_subpath + ".ts"),
                    os.path.join(src_dir, target_subpath + ".tsx"),
                    os.path.join(src_dir, target_subpath, "index.ts"),
                    os.path.join(src_dir, target_subpath, "index.tsx"),
                ]
                resolved = any(os.path.exists(p) for p in possible_paths)
                results["import_resolution"].append({
                    "file": rel_path,
                    "import": imp,
                    "type": "alias",
                    "resolved": resolved
                })
                if not resolved:
                    results["errors"].append(f"Broken alias import '{imp}' in {rel_path}")
            elif imp.startswith("."):
                # Relative path
                file_dir = os.path.dirname(filepath)
                possible_paths = [
                    os.path.join(file_dir, imp + ".ts"),
                    os.path.join(file_dir, imp + ".tsx"),
                    os.path.join(file_dir, imp, "index.ts"),
                    os.path.join(file_dir, imp, "index.tsx"),
                ]
                resolved = any(os.path.exists(p) for p in possible_paths)
                results["import_resolution"].append({
                    "file": rel_path,
                    "import": imp,
                    "type": "relative",
                    "resolved": resolved
                })
                if not resolved:
                    results["errors"].append(f"Broken relative import '{imp}' in {rel_path}")
            else:
                # Package import
                pkg_name = imp if not imp.startswith("@") else "/".join(imp.split("/")[:2])
                resolved = pkg_name in all_deps or imp == "react" or imp == "react-native"
                results["import_resolution"].append({
                    "file": rel_path,
                    "import": imp,
                    "type": "package",
                    "resolved": resolved
                })
                if not resolved:
                    results["errors"].append(f"Undeclared package import '{imp}' in {rel_path}")

    # 3. Verify GestureHandlerRootView in App.tsx
    if os.path.exists(app_tsx):
        with open(app_tsx, "r", encoding="utf-8") as f:
            app_content = f.read()
        
        has_gh_import = "import { GestureHandlerRootView }" in app_content or "GestureHandlerRootView" in app_content
        has_gh_wrap = "<GestureHandlerRootView" in app_content and "</GestureHandlerRootView>" in app_content
        
        # Check if GestureHandlerRootView wraps the return JSX
        return_match = re.search(r"return\s*\(\s*<GestureHandlerRootView[\s\S]*?</GestureHandlerRootView>\s*\);", app_content)
        is_outermost = return_match is not None
        
        # Check if flex: 1 style is applied
        has_flex_style = "flex: 1" in app_content and ("styles.container" in app_content or "flex: 1" in app_content)
        
        results["gesture_handler"].append({
            "has_import": has_gh_import,
            "has_wrap": has_gh_wrap,
            "is_outermost_return": is_outermost,
            "has_flex_style": has_flex_style
        })

    # 4. Verify agent_memory/m1_setup_recap.md
    recap_path = os.path.join(BASE_DIR, "agent_memory", "m1_setup_recap.md")
    if os.path.exists(recap_path):
        with open(recap_path, "r", encoding="utf-8") as f:
            recap_content = f.read()
        
        has_procedure = "## 2. Procedure" in recap_content or "Procedure" in recap_content
        has_goal = "## 1. Goal" in recap_content or "Goal" in recap_content
        has_details = "## 3. Details" in recap_content or "Details" in recap_content
        has_file_list = "File List" in recap_content
        has_deps = "Dependency Stack" in recap_content
        has_validation = "Verification" in recap_content
        
        results["recap_verification"].append({
            "exists": True,
            "size": len(recap_content),
            "has_procedure": has_procedure,
            "has_goal": has_goal,
            "has_details": has_details,
            "has_file_list": has_file_list,
            "has_deps": has_deps,
            "has_validation": has_validation
        })
    else:
        results["recap_verification"].append({"exists": False})
        results["errors"].append("agent_memory/m1_setup_recap.md missing")

    # 5. Check app.json and babel.config.js
    app_json_path = os.path.join(BASE_DIR, "app.json")
    if os.path.exists(app_json_path):
        with open(app_json_path, "r", encoding="utf-8") as f:
            app_json = json.load(f)
        supports_tablet = app_json.get("expo", {}).get("ios", {}).get("supportsTablet", False)
        orientation = app_json.get("expo", {}).get("orientation", "")
        results["project_md_compliance"].append({
            "supportsTablet": supports_tablet,
            "orientation": orientation
        })

    babel_path = os.path.join(BASE_DIR, "babel.config.js")
    if os.path.exists(babel_path):
        with open(babel_path, "r", encoding="utf-8") as f:
            babel_content = f.read()
        has_reanimated = 'react-native-reanimated/plugin' in babel_content
        results["project_md_compliance"].append({
            "has_reanimated_plugin": has_reanimated
        })

    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    run_verification()
