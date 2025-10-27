This folder should contain the official Phosphor web distribution files.

How to populate (PowerShell):

# create directory (if not already present)
md .\app\static\vendor\phosphor -Force

# download CSS
Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/dist/phosphor.css' -OutFile '.\app\static\vendor\phosphor\phosphor.css'

# Inspect the CSS for any url(...) references. If it references other files (fonts or svg), download them into the same folder.
# Example: if phosphor.css references 'phosphor.woff2', download it with:
# Invoke-WebRequest -Uri '<url-to-font>' -OutFile '.\app\static\vendor\phosphor\phosphor.woff2'

# After downloading, restart your Django dev server and reload the dashboard.
