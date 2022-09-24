PyInstaller --noconfirm --clean "./mtgatracker_backend.spec"
Remove-Item dist\mtgatracker_backend.zip
Compress-Archive -Path dist\mtgatracker_backend -DestinationPath dist\mtgatracker_backend.zip
Copy-Item app\Append.csv dist\mtgatracker_backend
