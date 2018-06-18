#!/usr/bin/env bash

start=$(date +%s)

if (( "$#" != 1 ))
then
    echo "Must provide version string to use (e.g. 0.1.0-alpha)"
exit 1
fi

version=$1
cleanVer=$(echo $version | cut -f1 -d "-")

# to update wt secret: `openssl rand -hex 5 > webtask/on_demand/secret-name`
echo "$version" > webtasks/on_demand/client-version

# update version in package.json
fixversion="import json; rp = open('electron/package.json', 'r'); contents = json.load(rp); rp.close(); print('ok'); contents['version'] = '$version'; wp = open('electron/package.json', 'w'); json.dump(contents, wp, indent=4, separators=(',', ': '))"
python -c "$fixversion"

yes | pyinstaller.exe mtgatracker_backend.spec --distpath appdist
#rm -rf build
#rm -rf mtgatracker_backend.spec

rm -r MTGATracker-win32-x64 || echo "nothing to remove, moving on"
rm -r MTGATracker-win32-x64_$version* || echo "nothing to remove, moving on"

rm -r electron/legal || echo "no legal to update"
cp -r legal electron/legal

yes | ./node_modules/.bin/electron-packager electron/ MTGATracker \
  --overwrite --version=$cleanVer --electron-version=1.7.6 \
  --ignore="\.git.*" --ignore=".*psd" --ignore="mtga_watch\.log.*" \
  --extra-resource="appdist" \
  --icon="electron/img/icon_small.ico" \
  --version-string.CompanyName='MTGATracker' \
  --version-string.LegalCopyright='Copyright (C) 2018 MTGATracker' \
  --version-string.FileDescription="MTGATracker tracks your decks and games" \
  --version-string.OriginalFilename='MTGATracker.exe' \
  --version-string.InternalName="MTGATracker" \
  --version-string.ProductName="MTGATracker" \
  --version-string.ProductVersion=$cleanVer \
  --asar

mv MTGATracker-win32-x64 MTGATracker-win32-x64_$version
/c/Program\ Files/7-Zip/7z.exe a -tzip MTGATracker-win32-x64_$version.zip MTGATracker-win32-x64_$version

cat > testbuild.js <<- EOM
console.log("enter winstaller")
var electronInstaller = require('electron-winstaller');

resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: 'MTGATracker-win32-x64_$version',
    outputDirectory: 'MTGATracker-win32-x64_$version-SQUIRREL',
    authors: 'MTGATracker',
    exe: 'MTGATracker.exe',
    loadingGif: 'updating.gif',
    remoteReleases: 'https://s3-us-west-1.amazonaws.com/mtgatracker/autoupdates/win',
  });

resultPromise.then(() => console.log("It worked!"), (e) => console.log(e));
console.log("waiting on winstaller to finish...")
EOM

sleep 1

node testbuild.js

md5sum MTGATracker-win32-x64_$version.zip
end=$(date +%s)
secs=$((end-start))
printf 'build took %dh:%dm:%ds\n' $(($secs/3600)) $(($secs%3600/60)) $(($secs%60))