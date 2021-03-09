const [ Discord, fs, WEBHOOK, defDevTime ] = [ 
    require("discord.js"), 
    require("fs"), 
    /http(s)?:\/\/(www.|ptb.|canary.)?discord(app)?.com\/api\/(v[0-9]*|webhooks)\//, 
    "America/Los_Angeles"
];

/**
 * @typedef {Object} Fields
 * @property {string} [name=""]
 * @property {string} [value=""]
 * @property {boolean} [inline=false]
 */

/**
 * @typedef {Object} Embed
 * @property {string} [title]
 * @property {string} [description]
 * @property {string|Date} [timestamp]
 * @property {string} [url]
 * @property {string|number} [color]
 * @property {Fields[]} [fields]
 * @property {Object} [author]
 * @property {string} [author.name]
 * @property {string} [author.icon_url]
 * @property {string} [author.url]
 * @property {Object} [footer]
 * @property {string} [footer.text]
 * @property {string} [footer.icon_url]
 * @property {Object} [thumbnail]
 * @property {string} [thumbnail.url]
 * @property {Object} [image]
 * @property {string} [image.url]
 */

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
        
        this.devTime = devTime || defDevTime;
        this.time = time * 60000;
        this.interval = null;

        /** * @private */
        this.debug = debug

        /** * @private */
        this.shouldInterval = interval;

        /** * @private */
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
     * @param {import("db-backup").Embed[]} [embeds] - The embeds to send with the files. (not required)
     * @example
     * ```js
     * const Database = new (require("db-backup"))("https://discord.com/api/webhooks/.../...")
     * Database.run({ test: require("./path-to-database-schema-model") }).then(() => null);
     * ```
     * @returns {Promise<void>}
     */
    async run(databases = {}, custom = { username: "Database Backup System", avatarURL: "https://cdn.discordapp.com/emojis/818562151404011560.png"}, embeds = []){
        if(typeof databases !== "object") return Promise.reject(`You didn't provide an object for the databases`);
        if(Object.keys(databases).length === 0) return Promise.reject(`You didn't provide any database objects`);
        
        let [ hook, files, { username, avatarURL }, defEmbeds ] = [
            new Discord.WebhookClient(this.id, this.token),
            [],
            custom,
            [ { title: "Database backup", color: 0xFF000, footer: { text: `Taken at • ${this.date()}` } } ]
        ]
        
        if(!embeds || !Array.isArray(embeds)) embeds = defEmbeds;
        if(Array.isArray(embeds) && embeds.length === 0) embeds = defEmbeds;
        if(this.shouldInterval && !this.interval) this.runInterval(databases, custom, embeds);
        
        for await (const list of Object.keys(databases)) {
            if(!databases[list]) continue;
            let db = await databases[list].find();
            if(!db || db.length === 0) continue;
            await fs.writeFileSync(`${__dirname}/json/${list}.json`, JSON.stringify(db, undefined, 2), err => err ? this.console(err) : null);
            files.push(`${__dirname}/json/${list}.json`);
            continue;
        };
        if(files.length === 0) {
            if(this.debug) this.console(`No files to save?`);
            return this;
        };
        await hook.send(null, { files, username, avatarURL, embeds }).catch((err) => this.console(`[DATABASE:BACKUP:ERROR]`, err));
        
        for (const s of files) {
            if(typeof s === "string") await fs.unlink(s, err => err ? this.console(err) : null);
        };

        if(this.debug) this.console(`Database backup taken${this.shouldInterval ? `, next run in: ${require("ms")(this.time, { long: true })}` : ``}`)
        return this;
    };
    
    /** * @returns {boolean} */
    clear(){
        if(!this.interval) return false;
        clearInterval(this.interval);
        return true;
    };

    /**
     * @private
     * @returns {boolean}
     */
    runInterval(databases = {}, custom = {}, embeds = []){
        if(this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.run(databases, custom, embeds), this.time);
        return true;
    };

    /** * @private */
    date() {
        return new Date().toLocaleString('en-US', { timeZone: this.devTime });
    };

    /** * @private  */
    console(...args) {
        return console.log(`[${this.date()}]:`, ...args);
    };
};