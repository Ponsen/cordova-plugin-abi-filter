const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

module.exports = context => {
    if (!context.opts.cordova.platforms.includes('android')) {
        return
    }
    const { ConfigParser } = context.requireCordovaModule('cordova-common');
    const utils = context.requireCordovaModule("cordova-lib/src/cordova/util");

    return new Promise((resolve, reject) => {

        //helper funcs
        function searchFilesByFilterRecursive(startPath, filter, callback) {

            if (!fs.existsSync(startPath)) {
                console.log("no dir ", startPath);
                return reject(new Error("folder " + startPath + " does not exist"))
            }

            var files = fs.readdirSync(startPath);
            for (var i = 0; i < files.length; i++) {
                var filename = path.join(startPath, files[i]);
                var stat = fs.lstatSync(filename);
                if (stat.isDirectory()) {
                    searchFilesByFilterRecursive(filename, filter, callback) //recurse
                } else if (filter.test(filename)) {
                    callback(filename);
                }
            }
        }

        console.log('ABI Filter applying changes...');
        const projectRoot = context.opts.projectRoot;

        const gradleFilePath = path.join(projectRoot, 'platforms/android/' + context.opts.plugin.id);

        //prefix changes according to project name - just searching for the file. folder is known anyway
        searchFilesByFilterRecursive(gradleFilePath, /\-build-extras.gradle$/, (filepath) => {

            //default values
            var abi_values = "armeabi-v7a,arm64-v8a,x86,x86_64"
            
            const configFile = new ConfigParser(utils.projectConfig(projectRoot))

            //Variables can come from 3 different places

            try{
                //config.xml
                //Prio 1 - plugin was already added or user added key to config.xml manually
                if (configFile.getPlugin(context.opts.plugin.id) && 
                    configFile.getPlugin(context.opts.plugin.id).variables && 
                    configFile.getPlugin(context.opts.plugin.id).variables.ABI_FILTER) {
                        abi_values = configFile.getPlugin(context.opts.plugin.id).variables.ABI_FILTER
                        console.log(`Using Values from user defined config preferences: ${abi_values}`);
                }

                //CLI Arg
                //Prio 2 - is present when plugin is added with --variable ABI_FILTER="a|b|c"
                else if (process.argv.join("|").indexOf("ABI_FILTER=") > -1) {
                    abi_values = process.argv.join("|").match(/ABI_FILTER=(.*?)(\||$)/)[1];
                    console.log(`Using Values from Cli-Variables: ${abi_values}`);
                }

                //plugin.xml
                //Prio 3 - default if user did not specify cli args or if plugin is just added
                else if (context.opts.plugin.pluginInfo.getPreferences().ABI_FILTER) {
                    abi_values = context.opts.plugin.pluginInfo.getPreferences().ABI_FILTER
                    console.log(`Using Values from default preferences: ${abi_values}`);
                }

            } catch(error){
                console.warn("Using defaults: " + abi_values);
            }

            //parse them values to a gradle readable string
            var abi_values_parsed = "";
            let abi_arr = abi_values.split(",");
            for (var i = 0; i < abi_arr.length; ++i) {
                abi_values_parsed +=  '"' + abi_arr[i] + '"' + (abi_arr.length - 1 === i ? "" : ",");
            }

            //find the line "abiFilters"
            const line_key = "abiFilters";
            var replacement_line = "            abiFilters " + abi_values_parsed;
            var replacement_file = "";

            //read gradle file from project
            var reader = readline.createInterface({
                input: fs.createReadStream(filepath)
            });

            reader.on('line', (line) => {
                if(line.trim().includes(line_key)){
                    replacement_file += replacement_line + os.EOL
                } else {
                    replacement_file += line + os.EOL
                }
            });

            reader.on('close', () => {

                //save (override) gradle file from project
                fs.writeFile(filepath, replacement_file, {encoding:'utf8',flag:'w'}, function(err) {
                    if(err) {
                        return reject(err);
                    }

                    return resolve("Applied ABI-Filters: " + abi_values);
                });
            })
        })

    }).then(message => {
        console.log(`${message}`);
    }).catch(message => {
        console.warn(`${message}`);
    });
};


