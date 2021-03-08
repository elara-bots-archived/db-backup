const [ Discord, fs, WEBHOOK, defDevTime ] = [ require("discord.js"), require("fs"), /http(s)?:\/\/(www.|ptb.|canary.)?discord(app)?.com\/api\/(v[0-9]*|webhooks)\//, "America/Los_Angeles" ];

module.exports = class DatabaseBackup {
    /**
     * @param {string} [webhook] - The webhook URL to backup the database(s) to
     * @param {Object} [extra]
     * @param {number} [extra.time=60] - Minutes to wait until doing the next backup round.
     * @param {boolean} [extra.interval=true] - If you want the interval to run, it's enabled by default.
     * @param {string} [extra.devTime=""] - The timeZone for you. 
     * @param {boolean} [extra.debug=false] - If you want the "Database backup taken." console log
     */
    constructor(webhook = "", extra = { time: 60, interval: true, devTime: defDevTime, debug: false }){
        let { time, interval, devTime, debug } = extra;
        if(!webhook || typeof webhook !== "string") throw new Error(`You need to provide a Discord webhook URL!`);
        if(!webhook.match(WEBHOOK)) throw new Error(`You didn't provide a valid Discord URL!`)
        if(typeof interval !== "boolean") interval = true;
        if(typeof debug !== "boolean") debug = false;
        if(typeof time !== "number") time = 60;
        this.devTime = devTime ?? defDevTime;
        this.time = time * 60000;
        
        /** * @private */
        this.debug = debug ?? false

        /** * @private */
        this.shouldInterval = interval;

        this.interval = null;
        this.webhook = webhook.replace(new RegExp(WEBHOOK, "gi"), "").split("/");
    };
    
    /** * @private */
    get id(){
        return this.webhook[0];
    };
    
    /** * @private */
    get token(){
        return this.webhook[1];
    };

    /**
     * @description Run the database backup, you need to provide the object with the database objects
     * @param {object} databases 
     * @param {Object} [?custom]
     * @param {string} [custom.username] - The username for the webhook
     * @param {string} [custom.avatarURL] - The avatar for the webhook
     * @example
     * ```js
     * const Database = new (require("db-backup"))("https://discord.com/api/webhooks/.../...")
     * Database.run({ test: require("./path-to-database-schema-model") }).then(() => null);
     * ```
     * @returns {Promise<void>}
     */
    async run(databases = {  }, custom = { username: "Database Backup System", avatarURL: "https://cdn.discordapp.com/emojis/818562151404011560.png" }){
        if(typeof databases !== "object") return Promise.reject(`You didn't provide an object for the databases`);
        if(Object.keys(databases).length === 0) return Promise.reject(`You didn't provide any database objects`);
        if(this.shouldInterval && !this.interval) this.runInterval(databases, custom);
        let hook = new Discord.WebhookClient(this.id, this.token),
            files = [],
            { username, avatarURL } = custom,
            time = () => new Date().toLocaleString('en-us', { timeZone: this.devTime }),
            log = (...args) => console.log(`[${time()}]:`, ...args);

        for await (const list of Object.keys(databases)) {
            if(!databases[list]) continue;
            let db = await databases[list].find();
            if(!db || db.length === 0) continue;
            await fs.writeFileSync(`${__dirname}/json/${list}.json`, JSON.stringify(db, undefined, 2), err => err ? console.log(err) : null);
            files.push(`${__dirname}/json/${list}.json`);
            continue;
        };
        if(files.length === 0) {
            if(this.debug) log(`No files to save?`);
            return this;
        }

        await hook.send(null, { files, username, avatarURL,
            embeds: [ { title: "Database backup", color: 0xFF000, footer: { text: `Taken at • ${time()}` } } ],
        }).catch((err) => log(err));
        
        for (const s of files) {
            if(typeof s === "string") await fs.unlink(s, err => err ? console.log(err) : null);
        };

        if(this.debug) log(`Database backup taken${this.shouldInterval ? `, next run in: ${require("ms")(this.time, { long: true })}` : ``}`)
        return this;
    };
    
    /**
     * @returns {boolean}
     */
    
    clear(){
        if(!this.interval) return false;
        clearInterval(this.interval);
        return true;
    }

    /**
     * @private
     * @returns {boolean}
     */
    runInterval(databases = {}, custom = {}){
        if(this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.run(databases, custom), this.time);
        return true;
    };
};