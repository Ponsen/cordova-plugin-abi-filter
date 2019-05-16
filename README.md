# About

This plugin adds a gradle file to your cordova android project. Depending on your configuration it causes your build to have only your specified ABI libraries.

## Install

````bash
cordova plugin add cordova-plugin-abi-filter #  --variable ABI_FILTER="armeabi-v7a,armeabi-v8a,x86,x86_64"
````

or

````bash
cordova plugin add https://github.com/Ponsen/cordova-plugin-abi-filter.git #  --variable ABI_FILTER= "armeabi-v7a,armeabi-v8a,x86,x86_64"
````

## Configuration



## Notes

"Mips"/"armeabi" support was removed in NDK r17.