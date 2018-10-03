#!/usr/bin/env bash

start=$(date +%s)
start_raw=$(date)

if (( "$#" != 1 ))
then
    echo "Must provide version string to use (e.g. 0.1.0-alpha)"
    exit 1
fi
version=$1

echo "Build start: $start_raw"

assetDir="MTGATracker-win32-x64_$version-SQUIRREL"

if [ ! -d "$assetDir" ];
then
  echo "$assetDir doesn't exist. You need to 'sh build.sh $version' first"
  exit 1
fi

setupFile=$assetDir/setup_mtgatracker_$version.exe
if [ ! -f "$setupFile" ];
then
  echo "$setupFile doesn't exist. You need to 'sh build.sh $version' first"
  exit 1
fi

if ! [ -x "$(command -v jq)" ]; then
  echo 'Error: jq is not installed. Get jq here: https://stedolan.github.io/jq/download/' >&2
  exit 1
fi

setupMd5=$(md5sum.exe MTGATracker-win32-x64_$version-SQUIRREL/setup_mtgatracker_$version.exe | cut -f 1 -d " ")

repo=mtgatracker/mtgatracker
updateRepo=mtgatracker/mtgatracker-updates
token=$(cat secret-token)

releaseBody="_This release is on the auto-update server; if you already have MTGATracker, you don't need to do anything except run it. MTGATracker will update itself!_\r\n\r\n \
### New in $version\r\n \
\r\n \
- ADD FEATURES\r\n \
\r\n \
## Verification hashes\r\n \
\r\n \
If this hash does not match, **do not open downloaded files** and please contact us immediately.\r\n \
\r\n \
You can find information on how to perform md5 checks on windows [here](https://www.lifewire.com/validate-md5-checksum-file-4037391).\r\n \
\r\n \
MD5: \`$setupMd5\`"

payload='{"tag_name": "'$version'", "draft": true, "name":"MTGATracker '$version'","body": "'$releaseBody'"}'

upload_url=$(curl -s -H "Authorization: token $token"  -d "$payload" \
     "https://api.github.com/repos/$repo/releases" | jq -r '.upload_url' | cut -f 1 -d "{")

echo "uploading setup.exe to release to url : $upload_url (about 6 mins, starting @ `date`)"

curl -s -H "Authorization: token $token"  \
        -H "Content-Type: application/exe" \
        --data-binary @$setupFile  \
        --progress-bar \
        "$upload_url?name=setup_mtgatracker_$version.exe&label=MTGATracker%20Setup" > garbo.out

updatePayload='{"tag_name": "'$version'", "draft": true, "name":"MTGATracker '$version' auto-update files","body": "This page is for robots only"}'
updateUpload_url=$(curl -s -H "Authorization: token $token"  -d "$updatePayload" \
     "https://api.github.com/repos/$updateRepo/releases" | jq -r '.upload_url' | cut -f 1 -d "{")

for nupkgFile in $assetDir/*.nupkg; do
  fileName=$(echo $nupkgFile | cut -f 2 -d /)
  echo "uploading $fileName to release to url: $updateUpload_url (about 6 mins, starting @ `date`)"
  curl -s -H "Authorization: token $token"  \
          -H "Content-Type: application/octet-stream" \
          --data-binary @$nupkgFile  \
          --progress-bar \
          "$updateUpload_url?name=$fileName&label=$fileName" > garbo.out
done
echo "finally: uploading RELEASES to release to url: $updateUpload_url (should be very fast)"
curl -s -H "Authorization: token $token"  \
        -H "Content-Type: application/octet-stream" \
        --data-binary @$assetDir/RELEASES  \
        --progress-bar \
        "$updateUpload_url?name=RELEASES&label=RELEASES" > garbo.out

echo "Success. Visit https://github.com/mtgatracker/mtgatracker/releases and https://github.com/mtgatracker/mtgatracker-updates/releases to finish publishing this release"