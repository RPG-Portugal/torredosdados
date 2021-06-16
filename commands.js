module.exports = function(dependencies){
    const {model, tools, moment, client, db, behaviors, keep} = dependencies;
    const commands = {
        valid: function(message){
            if(typeof message.content != 'string'){ return false; }
            if(message.content.length > 200){ return false; }
            if(message.content.indexOf(model.command_prefix) == -1){ return false; }
            let valid_lines = message.content.split("\n").filter(line=>line.indexOf(model.command_prefix) === 0);
            if(valid_lines.length != 1){ return false; }
            let parts = valid_lines[0].split(' ').map(p=>p.toLowerCase().trim().replace(',', ''));
            if(parts[0] == model.command_prefix && parts.length > 1){//prefix followed by a space and the actual command
                parts = parts.slice(1);
                parts[0] = model.command_prefix + parts[0];
            }
            if(parts[0].split(model.command_prefix).length != 2){ return false; }//one prefix character only
            let command = parts[0].replace(model.command_prefix, '');
            let command_args = parts.length > 1 ? parts.slice(1) : []; 
            if(!commands.items[command]){ return false; }
            if(model.reserved_commands[command] && message.author.id != model.user_id){ 
                if(model.reserved_commands[command] != 'admins'){ return false; }
                if(model.admins.indexOf(message.author.id) == -1){ return false; }
            }
            return {command:command, command_args:command_args};
        },
        run: function(message){
            let valid = commands.valid(message);
            if(!valid){ return false; }
            const member = client.guilds.cache.get(model.guild_id).members.cache.get(message.author.id);
            if(!member){ return false; }
            if(member.roles.cache.array().filter(role => role.id == model.new_members.role_id).length == 1){
                message.channel.send(model.new_members.you_need_gold);
                return false;
            }
            //a watchlist for disruptive users who may spam the bot
            let watched = db.prepare('SELECT id FROM watchlist WHERE username=:username OR user_id=:user_id').get(
                {username: member.username, user_id: member.id}
            );
            if(watched){ return false; }
            let reply = commands.items[valid.command].call(this, valid.command_args, member, message.channel);
            if(reply && typeof reply === 'string'){
                message.channel.send(`${message.author} ${reply}`);
            }
            if(model.delete_commands[valid.command]){
                message.delete();
            }
            return reply;
        },
        items: {
            count: function(command_args, member, channel){ return model.countMembers(); },
            roles: function(command_args, member, channel){ return model.countRoles(); },
            quero: function(command_args, member, channel){ 
                const keys = Object.keys(model.roles);
                let requested_keys = command_args.filter(requested_key=>keys.indexOf(requested_key)>-1);
                if(requested_keys.length == 0){
                    return `Estes são os items disponíveis: ${keys.join(', ')}.\n Podes dizer por exemplo !quero ${keys[2]} ${keys[4]} ${keys[0]}`;
                }
                let requested_ids = requested_keys.map(requested_key=>model.roles[requested_key]);
                let invalid_roles = [];
                let valid_roles = [];
                requested_ids.map(function(requested_id){
                    const role = client.guilds.cache.get(model.guild_id).roles.cache.get(requested_id);
                    if(role){ valid_roles.push(role); }else{ invalid_roles.push(role); }
                });
                if(invalid_roles.length > 0){ return `O role ${invalid_roles[0].name} já não se encontra no servidor :sweat_smile:`; }
                let valid_ids = valid_roles.map(valid_role=>valid_role.id);
                if(valid_ids.length == 0){ return 'Os roles disponíveis precisam de ser reconfigurados antes de os poder atribuir :sweat_smile:'; }
                let repeated_ids = valid_ids.filter(valid_id=>member.roles.cache.get(valid_id) != undefined);
                if(repeated_ids.length == 1 && requested_keys.length == 1){ return `Penso que já tens ${requested_keys[0]} :sweat_smile:`; }
                if(repeated_ids.length > 0){ return `Penso que já tens pelo menos alguns destes roles :sweat_smile:`; }
                member.roles.add(valid_ids);
                let answer = ` recebeste ${tools.commasAnd(valid_roles.map(valid_role=>valid_role.name))} :+1: ` ;
                answer += '*(podes retirar items com o comando !retira)*';
                return answer;
            },
            retira: function(command_args, member, channel){ 
                const values = Object.values(model.roles);
                const keys = Object.keys(model.roles);
                const current_roles = member.roles.cache.array();
                let removable_values = current_roles.reduce(function(removable_values, role){
                    if(values.indexOf(role.id) > -1){ removable_values.push(role.id); }
                    return removable_values;
                }, []);
                let removable_keys = removable_values.map(value=>keys[values.indexOf(value)]);
                if(removable_values.length == 0){ return 'Não tens roles que eu possa retirar.'; }
                let valid_ids = command_args.filter(key=>removable_values.indexOf(model.roles[key])>-1).map(valid_key=>model.roles[valid_key]);
                if(valid_ids.length == 0){ return `Estes são os items que te posso retirar: ${removable_keys.join(', ')}.`; }
                let answer = ' retirei-te ' + tools.commasAnd(valid_ids.map(valid_id=>current_roles.filter(role=>role.id==valid_id)[0].name))+ ' :wave:' ;
                member.roles.remove(valid_ids);
                return answer;
            },
            invites: function(command_args, member, channel){ return behaviors.checkInvites(); },
            channels: function(command_args, member, channel){ return behaviors.briefChannels(); },
            kick: function(command_args, member, channel){ return behaviors.kickOldestIdleNewMember(); },
            code: function(command_args, member, channel){ return behaviors.rotateInviteCode(); },
            members: function(command_args, member, channel){ return behaviors.updateMemberInformation(); },
            payments: function(command_args, member, channel){ return behaviors.checkPayments(); },
            hello: function(command_args, member, channel){ return tools.greet(moment()) + ` :wave:`; },
            ajuda: function(command_args, member, channel){ return model.help_text; },
            procura: function(command_args, member, channel){ return 'https://pt.wikipedia.org/wiki/' + tools.safeURLParam(command_args.join(' ')); },
            search: function(command_args, member, channel){ return 'https://en.wikipedia.org/wiki/' + tools.safeURLParam(command_args.join(' ')); },
            dicas: function(command_args, member, channel){ 
                let url = 'https://rpgportugal.com/dicas/' + tools.safeURLParam(command_args.join('')); 
                url += '?t=' + moment().format('YYYYMMDDHHmmss');
                return url;
            },
            copia: function(command_args, member, channel){
                if(command_args.length < 2){ return 'Necessito de um canal e do identificador da mensagem.'; }
                let channel_id = command_args[0].replace('<#', '').replace('>', ''); 
                const source_channel = client.guilds.cache.get(model.guild_id).channels.cache.get(channel_id);
                source_channel.messages.fetch({around: command_args[1], limit: 1}).then(messages=>{
                    let message = messages.first();
                    if(!message || !message.content){ var reply = 'Não encontrei essa mensagem.'; }
                    if(message.content.length > 1700){ var reply = 'Esta mensagem tem demasiados caracteres.'; }
                    else{
                        var reply = `Mensagem originalmente colocada por ${message.author}:\n` + message.content;
                        if(message.attachments.size>0){ reply += `\n${message.attachments.first().url}`; }
                    }
                    channel.send(reply)
                });
                return false;//have to answer asynchronously
            },
            member: function(command_args, member, channel){
                if(command_args.length < 1){ return 'Necessito do ID deste membro.'; }
                keep.member(command_args[0], function(member){
                    let avatar = member.user.displayAvatarURL().replace('.webp', '.png?size=128');
                    let reply = moment(member.joinedTimestamp).format('YYYY-MM-DD HH:mm:ss') + ': ' + member.displayName + ' (' + avatar + ')';
                    channel.send(reply);
                });
                return false;//have to answer asynchronously
            },
            rpgpt: function(command_args, member, channel){
                if(command_args.length < 1){ return 'https://rpgportugal.com'; }
                return 'https://rpgportugal.com/' + tools.safeURLParam(command_args[0].toLowerCase());
            },
            nível: function(command_args, member, channel){
                let found = db.prepare('SELECT SUM(level) AS level FROM member_levels WHERE user_id=:user_id').get({user_id: member.id});
                if(!found){ return 'Lamento, ainda não estás no servidor à tempo suficiente para ter calculado o teu nível.'; }
                if(found.level == 0 || !found.level){ found.level = 1; }
                return `Neste momento calculo que estás a nível **${found.level}** :muscle:`;
            },
            númeroaté: function(command_args, member, channel){
                if(command_args.length != 1){ return 'Diz-me até que número eu posso escolher.'; }
                var n = parseInt(command_args[0]);
                if(!Number.isInteger(n)){ return command_args[0] + ' não é um número válido para mim.'; }
                if(n < 2){ return 'Brincalhão, dá-me um número a sério.'; }
                return `Mmmm... vou escolher o número... **${tools.random(n)}**`;
            },
            gen: function(command_args, member, channel){
                if(command_args.length == 0){ return 'Indica-me que dados Genesys lançar. As letras válidas são: bsadpcf (ex: aapdd).'; }
                return tools.genesys.roll(client, command_args[0]);
            },
            avatar: function(command_args, member, channel){
                return `${member.user.displayAvatarURL()}\n${member.displayName}`;
            },
            canais: function(){
                return behaviors.listAvailableChannels(true);//pass true to return the text instead of behaving as normal
            }
        }
    };
    commands.items['4df'] = function(command_args, member, channel){ 
        return ` **${tools.random(3, -1) + tools.random(3, -1) + tools.random(3, -1) + tools.random(3, -1)}**`; 
    };
    const emoji_dice = [2,3,4,6,8,10,12,20,100, 'f'];
    const dice_pools = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
    emoji_dice.map(n=>{ 
        dice_pools.map(size=>{ 
            commands.items[size + 'd' + n] = function(command_args, member, channel){ 
                let modifier = false;
                if(command_args.length > 0 && command_args[0].length > 1){
                    if(command_args[0].indexOf('+') == 0){
                        modifier = parseInt(command_args[0].replace('+', ''));
                        if(modifier === NaN || command_args[0].indexOf('d') > -1){ modifier = false; }//parseInt of 1d4 is still 1
                    }else if(command_args[0].indexOf('-') == 0){
                        modifier = parseInt(command_args[0].replace('-', ''));
                        if(modifier === NaN || command_args[0].indexOf('d') > -1){ modifier = false; }else{ modifier = modifier*(-1); }
                    } 
                }
                let dice = dice_pools.slice(0, size);
                dice = dice.map(d=>tools.random(n));
                if(command_args.indexOf('misturados') === -1){
                    dice.sort((a, b) => b - a); //descending order
                }
                if(command_args.indexOf('somados') > -1 || n == 'f'){ 
                    var total = dice.reduce(function(t, die){return t + die;}, 0); 
                }else{ var total = false; }
                if(modifier !== false){ total = dice.reduce(function(t, die){return t + die;}, modifier); }
                let answer = dice.reduce(function(answer, die){ return answer + `${tools.emoji(client, 'd'+n)}**${die}** `; }, ''); 
                if( (command_args.length > 0 && total !== false) || n == 'f' ){
                    if(modifier === false){ answer+=` (${total})`; }else{ answer +=` (${command_args[0]} dá ${total})`;}
                }else if(commands.items[command_args[0]]){
                    answer += commands.items[command_args[0]]([]);
                    for(var i=1; i<4; i++){//and for a few additional dice
                        if(commands.items[command_args[i]]){ answer += commands.items[command_args[i]]([]); }
                    }
                }
                return answer;
            };
        });
        commands.items['d' + n] = commands.items['1d' + n];
    });

   // command aliases
    commands.items.numeroate = commands.items['númeroaté'];
    commands.items.until = commands.items.numeroate;

    return commands;
};
