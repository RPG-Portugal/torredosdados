//https://discordapp.com/oauth2/authorize?client_id=123456789012345678&scope=bot
const model = require('./model.json');
const tools = require('./tools.js');
const request = require('request');
const EventEmitter = require('events').EventEmitter;
const save = new EventEmitter();
const moment = require('moment'); moment.locale('pt');
const CronJob = require('cron').CronJob;
const Discord = require('discord.js');
const client = new Discord.Client();
const db = require('better-sqlite3')(model.sqlite_path, {fileMustExist:true});
db.defaultSafeIntegers(true); //https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/integer.md
process.on('exit', function(){ db.close(); console.log('<<< ending process'); } );
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));
console.log('>>> starting process');

model.countMembers =()=>{
    let guild = client.guilds.get(model.guild_id);
    model.data.available = guild.available;
    if(!model.data.available){ 
        save.emit('downDiscord', model.data);
        return false; 
    }
    let valid_members = guild.members.array().filter( m => (!m.user.bot && m.roles.size > 0) );//not counting members without roles or bots
    model.data.memberCount = valid_members.length;
    if(valid_members.length > 0){
        model.data.onlineCount = valid_members.filter(m => m.presence.status != 'offline').length;
        model.data.percentage = ((model.data.onlineCount / model.data.memberCount) * 100).toFixed();
    }else{
        model.data.onlineCount = 0;
        model.data.percentage = 0;
    }
    var added_missing_golden_role = false;
    let new_members = valid_members.filter(function(member, index){
        let is_green = (member.roles.array().filter(role => role.id == model.new_members.role_id).length == 1);
        if(is_green){ return true; }
        let has_golden_role = (member.roles.array().filter(role => role.id == model.golden_role_id).length == 1);
        if(has_golden_role){ return false; }
        if(!added_missing_golden_role && member.roles.array().length > 1){//TODO maybe a better validation
            member.addRole(model.golden_role_id);
            added_missing_golden_role = true;
            log_channel.message(`Dei Douradinho em falta ao ${member.displayName}`);
        }
        return false;
    }); 
    model.data.new_members_count = new_members.length;
    save.emit('countMembers', model.data)
    keep.new_members(new_members);    
    return model.data;
};
model.countRoles =()=>{
    let guild = client.guilds.get(model.guild_id);
    model.data.available = guild.available;
    if(!model.data.available){ 
        save.emit('downDiscord', model.data);
        return false; 
    }
    let role_count = {};
    let valid_members = guild.members.array().filter( m => (!m.user.bot && m.roles.size > 0) );//not counting members without roles or bots
    valid_members.map(function(member){
        member.roles.array().map(function(role){
            if(!role_count[role.id]){ role_count[role.id] = 0; }
            role_count[role.id] ++;
        });
    });
    let roles = [];
    guild.roles.array().map(function(role){
        if(!role_count[role.id] || role.id == guild.id){ return false; }//exclude @everyone role which has the same id as the guild
        if(role.id == model.golden_role_id || role.id == model.new_members.role_id){ return false; }
        roles.push({ id: role.id, name: role.name, members_count: role_count[role.id] });
    });
    roles.sort(function(a, b){ 
        if(a.name.indexOf('Joga ') + b.name.indexOf('Joga ') > -2){
            return b.name.indexOf('Joga ') - a.name.indexOf('Joga ');
        }
        return b.members_count - a.members_count; 
    });
    model.data.roles = roles;
    save.emit('countRoles', model.data)
    return model.data;
};

const behaviors = {
    addEntryRole: function(member){
        let watched = db.prepare('SELECT id FROM watchlist WHERE username=:username OR user_id=:user_id').get(
            {username: member.username, user_id: member.id}
        );
        if(watched){ 
            client.channels.get(model.new_members.channel_id).send(`Olá ${member}. Algo me diz que já te conheço...`);
            return false; 
        }
        member.addRole(model.new_members.role_id);
        let rules_channel = client.channels.get(model.new_members.rules_channel_id);
        let text = `Olá ${member} :wave: ${model.new_members.greeting}`;
        setTimeout(function(text){//sometimes the message appears before the member actually enters the server
            client.channels.get(model.new_members.channel_id).send(text);
        }.bind(this, text), 5000);
        let update_sql = `UPDATE member SET last_removed=NULL WHERE user_id=:user_id`;
        db.prepare(update_sql).run({user_id:member.id});
    },
    checkInvites: function(member){//invite information is logged to help detect duplicate users or ban evasion (Discord support is currently flooded)
        let invites = db.prepare("SELECT * FROM invite WHERE logged=0 ORDER BY timestamp ASC").all();
        if(invites.length == 0){ return false; }
        let unique = {};//if there are several from the same ip, no need to show all beyond the first
        let text = invites.reduce(function(text, i){
            if(unique[i.ip]){ return text; }
            unique[i.ip] = true;
            text = text + `Convite pedido a **${i.timestamp}** pelo endereço **${i.ip}** `;
            text = text + `(browser **${i.user_agent_hash}** numa janela **${i.window_width}x${i.window_height}**)\n`;
            if(i.referrer){ text = text + ` Origem: ${i.referrer} `; }
            return text;
        }, '');
        if(invites.length == 1 || Object.keys(unique).length == 1){//localize the ip address since it's just one request
            request({url: 'http://ip-api.com/json/' + invites[0].ip, json: true}, function(error, response, data){
                if(error || !data || !data.status || data.status != 'success'){ log_channel.message(text); }
                else{
                    text = text + `Possível localização: [ ${data.country}, ${data.regionName}, ${data.city} ]`;
                    log_channel.message(text);
                }
            });
        }else{
            log_channel.message(text);
        }
        if(member && invites.length == 1){//member has just entered and only one invite is not yet logged
            db.prepare("UPDATE invite SET logged=1, possible_user_id=:possible_user_id WHERE id=:id").run(
                {possible_user_id: member.id, id: invites[0].id.toString()}
            ); 
        }else{ db.prepare("UPDATE invite SET logged=1 WHERE logged=0").run(); }
        return invites;
    },
    checkRaidCount: function(){
        model.new_members.raid_count ++;//rotate code if more than 1 person enters under a minute
        if(model.new_members.raid_count > 1){ behaviors.rotateInviteCode(); }
        setTimeout(function(){ model.new_members.raid_count = 0; }, model.new_members.raid_timeout);
    },
    sayGoodbye: function(member){
        if(!member.displayName){ return false; }
        let text = `Penso que ${member.displayName} acaba de sair do servidor :wave:`;
        log_channel.message(text);
        //client.channels.get(model.new_members.channel_id).send(text);
        keep.member_removed(member);
    },
    briefChannels: function(){
        var guild = client.guilds.get(model.guild_id);
        var relevant_channels = db.prepare(`
        SELECT DISTINCT channel_id FROM message WHERE createdTimestamp>DATE('now', '-1 day') AND channel_id IN (${model.briefable_channels.join(',')})
        `).all();
        relevant_channels.map(function(m){
            var channel = guild.channels.get(m.channel_id.toString()); 
            if(!channel){ return false; }
            var text = `:clipboard: **${channel}** *${channel.topic}*`;
            channel.fetchPinnedMessages().then(function(pins){
                if(pins.size > 0){ var friendly_date = moment(channel.lastPinAt).format('D [de] MMMM [de] YYYY'); }
                switch(pins.size){
                    case 0: text = text + `\n:pushpin: Este canal ainda não tem mensagens afixadas.`; break;
                    case 1: text = text + `\n:pushpin: Este canal tem uma mensagem afixada a ${friendly_date}.`; break;
                    default: text = text + `\n:pushpin: Este canal tem ${pins.size} mensagens afixadas (a última a ${friendly_date})`; break;
                }
                channel.send(text);
            });
        });
        return relevant_channels;
    },
    reactToAuthorExit: function(message, after_a_while){
        if(!message || !message.author || !message.author.presence || !message.author.presence.status){ return false; }
        if(message.content || message.attachments.size>0 || message.embeds.length>0){ return false; }//should be a welcome message
        if(!after_a_while){
            if(message.author.presence.status != 'online'){ return false; }
            setTimeout(behaviors.reactToAuthorExit.bind(this, message, true), 30000);
        }else{
            let guild = client.guilds.get(model.guild_id);
            if(!guild.member(message.author.id)){ // not found in server
                return false;
            }else if(message.author.presence.status == 'online'){//still online
                setTimeout(behaviors.reactToAuthorExit.bind(this, message, true), 30000);
            }else{
                let text = `Parece-me que ${message.author.username} passou de estar online para ${message.author.presence.status}. Até à próxima :wave:`;
                client.channels.get(model.new_members.channel_id).send(text);
            }
        }
    },
    kickOldestIdleNewMember: function(){
        let idle_member = db.prepare(`
        SELECT user_id, joinedTimestamp, displayName FROM new_member 
        WHERE joinedTimestamp<DATE('now', '-7 day') AND presence='offline' LIMIT 1
        `).get({});
        if(!idle_member){ return false; }
        var guild = client.guilds.get(model.guild_id);
        let member = guild.member(idle_member.user_id.toString()) 
        if(!member || member.lastMessageID || member.presence.status !='offline'){ return false; }
        let kick_reason = 'Retirado(a) do servidor por inactividade. Procura interagir com a comunidade quando voltares ao RPG Portugal.';
        let text = `
        **${idle_member.displayName}** está no servidor desde ${idle_member.joinedTimestamp} sem dizer nada. Fiz-lhe kick com o texto: "${kick_reason}"`;
        log_channel.message(text)
        member.kick(kick_reason);
        keep.member_removed(member);
    },
    rotateInviteCode: function(){
        const rules_channel = client.channels.get(model.new_members.rules_channel_id);
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        rules_channel.fetchInvites().then(function(invites_collection){
            let invites = invites_collection.array();
            invites.map(function(invite){//should be only one
                invite.delete('replacing this with a new invite as of ' + timestamp);
            });
            rules_channel.createInvite({
                maxAge: 0,
                unique: true,
                reason: 'to protect the server from unkown attackers as of ' + timestamp
            }).then(function(invite){
                if(!invite.code){ return false; }
                log_channel.message('Solicitei um novo código para convite ao Discord: ' + invite.code)
                let update = { value: invite.code };
                let update_sql = `UPDATE model SET value=:value WHERE property='invite_code'`;
                db.prepare(update_sql).run(update);
            }).catch(console.log);
        }).catch(console.log);
    },
    listAvailableChannels: function(return_text){
        let text = Object.keys(model.channels).reduce(function(text, key){
            const channel = client.channels.get(model.channels[key]);
            text += "`!quero " + key + "` para o canal " + channel + "\n"; 
            return text;
        }, "No servidor temos canais específicos a vários RPGs.\nPodes obter acesso aos que te interessarem com o comando `!quero`:\n");
        text += '(se quiseres acesso a todos e mais alguns, pede o role Todos os RPGs aos administradores)';
        if(return_text){ return text; }
        client.channels.get("651372855161913354").send(text);//#roleplaying-games
    }
}

const commands = require('./commands.js')({model:model, tools:tools, moment:moment, client:client, db:db, behaviors:behaviors});

const keep = {
    message: function(message){
        if(!message || !message.id){ return false; }//maybe deleted
        let insert = {
            id: message.id, 
            content: message.cleanContent, 
            createdTimestamp: moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm:ss'),
            editedTimestamp: message.editedTimestamp ? moment(message.editedTimestamp).format('YYYY-MM-DD HH:mm:ss') : null, 
            channel_id: message.channel.id, 
            user_id: message.author.id, 
            first_attachment: message.attachments.size>0 ? message.attachments.first().url : null, 
            first_embed: message.embeds.length>0 ? message.embeds[0].url : null, 
            first_reaction_user_id: message.reactions.size>0 ? message.reactions.first().users.first().id : null, 
            first_mention_user_id: message.mentions.users.size>0 ? message.mentions.users.first().id : null, 
            word_count: message.content.split(' ').length
        };
        if(tools.userReacted(message, model.user_id, '📣')){ insert.for_publication = 1; }
        let insert_sql = `INSERT OR IGNORE INTO message(${Object.keys(insert).join(', ')}) VALUES(:${Object.keys(insert).join(', :')})`;
        db.prepare(insert_sql).run(insert);
        setTimeout(function(message){
            keep.reactions(message);
        }.bind(this, message), model.keep_delay * 36);// ex: 10 minutes times 36 is 6 hours
    },
    reactions: function(message){
        if(!message || !message.id){ return false; }//maybe deleted
        let update = {
            id: message.id,
            first_reaction_user_id: message.reactions.size>0 ? message.reactions.first().users.first().id : null, 
            for_publication: tools.userReacted(message, model.user_id, '📣') ? 1 : 0
        };
        let update_sql = `UPDATE message SET first_reaction_user_id=:first_reaction_user_id, for_publication=:for_publication WHERE id=:id`;
        db.prepare(update_sql).run(update);
    },
    count: function(data){
        let insert = {memberCount: data.memberCount, onlineCount: data.onlineCount, percentage: data.percentage};
        let insert_sql = `INSERT INTO guild(${Object.keys(insert).join(', ')}) VALUES(:${Object.keys(insert).join(', :')})`;
        db.prepare(insert_sql).run(insert);
    },
    new_members: function(new_members){
        db.prepare("DELETE FROM new_member").run(); 
        new_members.map(function(member){
            let insert = {
                user_id: member.id,
                displayName: member.displayName,
                joinedTimestamp: moment(member.joinedTimestamp).format('YYYY-MM-DD HH:mm:ss'),
                lastMessageID: member.lastMessageID,
                presence: member.presence.status
            };
            let insert_sql = `INSERT INTO new_member(${Object.keys(insert).join(', ')}) VALUES(:${Object.keys(insert).join(', :')})`;
            db.prepare(insert_sql).run(insert);
        });
    },
    direct_command: function(row){
        row.arguments = (row.arguments ? row.arguments.substr(0, 200) : null); 
        row.reply = (row.reply ? row.reply.substr(0, 200) : null); 
        let exists = db.prepare('SELECT user_id, item FROM direct_command WHERE user_id=:user_id AND item=:item').get(
            {user_id:row.user_id, item:row.item}
        );
        if(exists){ 
            let update_sql = `
            UPDATE direct_command SET timestamp=STRFTIME('%Y-%m-%d %H:%M:%S','now'), arguments=:arguments, reply=:reply 
            WHERE user_id=:user_id AND item=:item`;
            db.prepare(update_sql).run(row);
        }else{
            let insert_sql = `INSERT INTO direct_command(${Object.keys(row).join(', ')}) VALUES(:${Object.keys(row).join(', :')})`;
            db.prepare(insert_sql).run(row);
        }
    },
    member_removed: function(member){
        const identification = { user_id: member.id };
        let update_sql = `
        UPDATE member SET token=NULL, identifier=NULL, last_removed=STRFTIME('%Y-%m-%d %H:%M:%S','now'), last_change=STRFTIME('%Y-%m-%d %H:%M:%S','now') 
        WHERE user_id=:user_id 
        `;
        db.prepare(update_sql).run(identification);
    }
}

const log_channel = {
    countMembers: function(data){
        let text = `**${data.percentage}%** estão online, **${data.onlineCount}** de um total de **${data.memberCount}** no servidor`;
        text += ` (${data.new_members_count} deste total ainda são verdes).`;
        log_channel.message(text);
        return text;
    },
    countRoles: function(data){
        let relevant_data = data.roles.filter(function(role){ return (role.members_count > 6); });
        const requestable_roles = Object.keys(model.roles).reduce(function(requestable_roles, item){
            requestable_roles[model.roles[item]] = item; 
            return requestable_roles;
        }, {});
        let text = relevant_data.reduce(function(text, role, index){
            text += `@ ${role.name}: ${role.members_count}`;
            if(requestable_roles[role.id]){ text += " `!quero " + requestable_roles[role.id] + "`"; }
            return text + "\n";
        }, `**Membros dentro de cada role com mais de 6 pessoas:**\n`);
        //log_channel.message(text);
        client.channels.get(model.new_members.channel_id).send(text);
        return text;
    },
    downDiscord: function(data){
        let text = `${data.name} está em baixo.`;
        log_channel.message(text);
    },
    message: function(text){ client.channels.get(model.log.channel_id).send(text); },
    webhook: async function(text){
        const channel = client.channels.get(model.log.channel_id);
        try{
            const webhooks = await channel.fetchWebhooks();
            const webhook = webhooks.first();
            await webhook.send(text, {});
        }catch(error){ console.error('Webhook error: ', error); }
    }
};

const direct_commands = require('./direct_commands.js')(
    {model:model, tools:tools, moment:moment, client:client, db:db, keep:keep, request:request, log_channel:log_channel}
);

save.on('countMembers', data=>{
    log_channel.countMembers(data);
    keep.count(data);
});
save.on('countRoles', data=>{
    log_channel.countRoles(data);
});
save.on('downDiscord', data=>{
    log_channel.downDiscord(data);
});
save.on('message_posted', message=>{
    keep.message(message);
});

client.on('ready', () => {
    let message = `Iniciei processo e obtive ligação (x${model.data.ready_count})`;
    model.data.ready_count ++;
    model.data.reconnecting_count = 0;
    console.log(moment().format('YYYY-MM-DD hh:mm:ss') + ' ' + message);
    log_channel.message(message);
});
client.on('message', message => {
    if(message.system){ return false; }
    if(message.channel.type == 'dm'){ 
        direct_commands.run(message);
        return false; 
    }
    if(message.author.bot){ return false; }
    let valid_command = commands.run(message);
    if(valid_command){ return valid_command; }
    setTimeout(function(message){//give it time for edits, embeds, reactions, deletes...
        save.emit('message_posted', message); 
    }.bind(this, message), model.keep_delay); 
    behaviors.reactToAuthorExit(message);
});
client.on('guildMemberAdd', member => {
    if(member.guild.id != model.guild_id){ return false; }
    behaviors.addEntryRole(member);
    behaviors.checkInvites(member);
    behaviors.checkRaidCount();
});
client.on('guildMemberRemove', member => {
    if(member.guild.id != model.guild_id){ return false; }
    behaviors.sayGoodbye(member);
});
client.on('error', error => {
	 console.error('The websocket connection encountered an error: ', error);
});
client.on('warn', error => { console.log('Client warning: ', error); });
//client.on('debug', error => { console.log('DEBUG: ', error); });
client.on('reconnecting', function(){
    model.data.reconnecting_count ++;
    //if(model.data.reconnecting_count % 100 != 0){ return false; }
    //log_channel.webhook(`...a tentar obter ligação perdida (${model.data.reconnecting_count} reconexões até agora)`);
    //let message = ` a tentar reconnectar`;
    //console.log(moment().format('YYYY-MM-DD hh:mm:ss') + ' ' + message);
});
client.on('resume', function(){
    model.data.ready_count ++;
    //if(model.data.ready_count % 100 != 0){ return false; }
    //let message = `Recuperei a ligação (x${model.data.ready_count - 1})`;
    //console.log(moment().format('YYYY-MM-DD hh:mm:ss') + ' ' + message);
    //log_channel.message(message);
});
process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
});

client.login(model.token);


const job_every_5m = new CronJob('*/5 * * * *', function(){
    behaviors.checkInvites();
}, null, true, 'Europe/Lisbon');
const job_every_6h = new CronJob('0 */6 * * *', function(){
    model.countMembers();
}, null, true, 'Europe/Lisbon');
//const job_every_12h = new CronJob('10 */12 * * *', function(){
//}, null, true, 'Europe/Lisbon');
const job_every_day = new CronJob('2 12 * * *', function(){
    behaviors.kickOldestIdleNewMember();
}, null, true, 'Europe/Lisbon');
const job_every_lateafternoon = new CronJob('2 18 * * *', function(){
    behaviors.kickOldestIdleNewMember();
}, null, true, 'Europe/Lisbon');
const job_every_night = new CronJob('0 3 * * *', function(){
    behaviors.rotateInviteCode();
}, null, true, 'Europe/Lisbon');
const job_every_wednesday = new CronJob('0 4 * * 3', function(){
    behaviors.briefChannels();
    setTimeout(behaviors.listAvailableChannels, 60000);
}, null, true, 'Europe/Lisbon');
const job_every_sunday = new CronJob('0 10 * * 0', function(){
    model.countRoles();
}, null, true, 'Europe/Lisbon');



