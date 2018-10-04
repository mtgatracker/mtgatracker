#!/usr/bin/env bash

start=$(date +%s)
start_raw=$(date)

if (( "$#" != 1 ))
then
    echo "Must provide version string to use (e.g. 0.1.0-alpha)"
exit 1
fi

echo "Build start: $start_raw"

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

yes | ./electron/node_modules/.bin/electron-packager electron/ MTGATracker \
  --overwrite --version=$cleanVer --electron-version=1.8.8 \
  --ignore="\.git.*" --ignore=".*psd" --ignore="upload_failure\.log" --ignore="mtga_watch\.log.*" \
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

cd electron
cat > testbuild.js <<- EOM
const request = require("request")
console.log("enter winstaller")
var electronInstaller = require('electron-winstaller');

let releasesUrl = "https://api.github.com/repos/mtgatracker/mtgatracker-updates/releases"
let requestOptions = {
  url: releasesUrl,
  headers: {
    'User-Agent': 'mtgatracker-build-script'
  }
}

request(requestOptions, (err, res, body) => {

  let { tag_name } = JSON.parse(body)[0]
  let remoteReleasesURL = \`https://github.com/mtgatracker/mtgatracker-updates/releases/download/\${tag_name}\`

  let resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: '../MTGATracker-win32-x64_$version',
    outputDirectory: '../MTGATracker-win32-x64_$version-SQUIRREL',
    authors: 'MTGATracker',
    exe: 'MTGATracker.exe',
    loadingGif: '../updating.gif',
    remoteReleases: remoteReleasesURL,
  });

  resultPromise.then(() => console.log("It worked!"), (e) => console.log(e));
  console.log("waiting on winstaller to finish...")
})

EOM

sleep 1

DEBUG=electron-windows-installer:main node testbuild.js

mv MTGATracker-win32-x64_$version-SQUIRREL/Setup.exe MTGATracker-win32-x64_$version-SQUIRREL/setup_mtgatracker_$version.exe

end=$(date +%s)
secs=$((end-start))
printf 'build took %dh:%dm:%ds\n' $(($secs/3600)) $(($secs%3600/60)) $(($secs%60))