module.exports = function (context) {
    //only procecss android platform
    if (!context.opts.cordova.platforms.includes('android')) {
        return
    }
    
    console.log('ABI Filter applying changes...')

    //Requirements
    const Q = context.requireCordovaModule('q')
    const deferral = new Q.defer()

    const common = context.requireCordovaModule('cordova-common')
    const utils = context.requireCordovaModule('cordova-lib/src/cordova/util')
    const fs = context.requireCordovaModule('fs')
    const path = context.requireCordovaModule('path')
    const readline = context.requireCordovaModule('readline')
    const os = context.requireCordovaModule('os')

    const projectRoot = context.opts.projectRoot

    const gradleFilePath = path.join(projectRoot, 'platforms/android/' + context.opts.plugin.id)

    //helper funcs
    function searchFilesByFilterRecursive(startPath, filter, callback) {

        if (!fs.existsSync(startPath)) {
            console.log("no dir ", startPath)
            deferral.reject(new Error("folder " + startPath + " does not exist"))
        }

        var files = fs.readdirSync(startPath)
        for (var i = 0; i < files.length; i++) {
            var filename = path.join(startPath, files[i])
            var stat = fs.lstatSync(filename)
            if (stat.isDirectory()) {
                searchFilesByFilterRecursive(filename, filter, callback) //recurse
            }
            else if (filter.test(filename)) callback(filename)
        }
    }

    //prefix changes according to project name - just searching for the file. folder is known anyway
    searchFilesByFilterRecursive(gradleFilePath, /\-build-extras.gradle$/, (filepath) => {

        //default values
        var abi_values = "armeabi-v7a,arm64-v8a,x86,x86_64"

        //Variables can come from 3 different places

        try{
            //plugin.xml
            //Prio 3 - default if user did not specify cli args or if plugin is just added
            if (context.opts.plugin.pluginInfo.getPreferences().ABI_FILTER) {
                abi_values = context.opts.plugin.pluginInfo.getPreferences().ABI_FILTER
            }

            //CLI Arg
            //Prio 2 - is present when plugin is added with --variable ABI_FILTER="a|b|c"
            if (context.opts.cli_variables && context.opts.cli_variables.ABI_FILTER) {
                abi_values = context.opts.cli_variables.ABI_FILTER
            }

            //config.xml
            //Prio 1 - plugin was already added or user added key to config.xml manually
            const configFile = new common.ConfigParser(utils.projectConfig(projectRoot))
            if (configFile.getPlugin(context.opts.plugin.id).variables.ABI_FILTER) {
                abi_values = configFile.getPlugin(context.opts.plugin.id).variables.ABI_FILTER
            }
        } catch(error){
            console.warn("Using defaults: " + abi_values);
        }

        //parse them values to a gradle readable string
        var abi_values_parsed = "";
        let abi_arr = abi_values.split(",");
        for (var i = 0; i < abi_arr.length; ++i) {
            abi_values_parsed +=  '"' + abi_arr[i] + '"' + (abi_arr.length - 1 === i ? "" : ",")
        }

        //find the line "abiFilters"
        const line_key = "abiFilters"
        var replacement_line = "            abiFilters " + abi_values_parsed
        var replacement_file = ""

        //read gradle file from project
        var reader = readline.createInterface({
            input: fs.createReadStream(filepath)
        })

        reader.on('line', (line) => {
            if(line.trim().includes(line_key)){
                replacement_file += replacement_line + os.EOL
            } else {
                replacement_file += line + os.EOL
            }
        })

        reader.on('close', () => {

            //save (override) gradle file from project
            fs.writeFile(filepath, replacement_file, {encoding:'utf8',flag:'w'}, function(err) {
                if(err) {
                    deferral.reject(err)
                }
            
                console.log("Applied ABI-Filters: " + abi_values)
                deferral.resolve()
            }); 
        })
    })

    return deferral.promise
}