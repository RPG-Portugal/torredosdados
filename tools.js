module.exports.random = function(max=6, min=1){
    if(max == 'f'){//fate dice
        max = 3;
        min = -1;
    }
    return Math.floor(Math.random() * Math.floor(max)) + min;   
};
module.exports.greet = function(m){// receives a momentjs object
	var g = 'Olá'; //return g
	if(!m || !m.isValid()) { return; } //if we can't find a valid or filled moment, we return.
	var split_afternoon = 13 //24hr time to split the afternoon
	var split_evening = 20 //24hr time to split the evening
	var currentHour = parseFloat(m.format("HH"));
	if(currentHour >= split_afternoon && currentHour <= split_evening) { g += ", boa tarde"; } 
    else if(currentHour >= split_evening) { g += ", boa noite"; } 
    else { g += ", bom dia"; }
	return g;
};
module.exports.userReacted = function(message, user_id, reaction_name){
    const reaction_found = message.reactions.cache.find(reaction=>reaction.emoji.name==reaction_name);
    if(!reaction_found){ return false; }
    const user_found = reaction_found.users.cache.find(user=>user.id==user_id);
    return user_found;
};
function emoji(client, name){
    const emoji_found = client.emojis.cache.find(emoji => emoji.name == name);
    if(!emoji_found){ return `:${name}:`; }
    return emoji_found;
};
module.exports.emoji = emoji;
module.exports.safeURLParam = function(text){
    return encodeURIComponent(text.trim().replace(/[^a-zA-Z\d\s:\u00C0-\u00FF]/gi,''));
};
module.exports.commasAnd = function(arr){
    if(arr.length == 1){ return arr[0]; }
    return arr.slice(0,-1).join(', ') + ' e ' + arr[arr.length-1];
};
module.exports.randomTokenFromID = function(id){//random not-very-scary token based on the discord snowflake
    var token = parseInt(id).toString(16);
    token += token;
    var array = token.split('');
    for(let i=array.length-1; i>0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join(''); 
};
module.exports.genesys = {
    dice: {
        b:[ 
            ['black_large_square'], ['black_large_square'], ['success'], ['success', 'advantage'], ['advantage', 'advantage'], ['advantage'] 
        ],
        s:[ 
            ['black_large_square'], ['black_large_square'], ['fail'], ['fail'], ['threat'], ['threat'] 
        ],
        a:[ 
            ['black_large_square'], ['success'],  ['success'],  ['success', 'success'],  ['advantage'],  ['advantage'],  ['success', 'advantage'],  ['advantage', 'advantage'] 
        ],
        d:[ 
            ['black_large_square'], ['fail'],  ['fail', 'fail'],  ['threat'],  ['threat'],  ['threat'],  ['threat', 'threat'],  ['fail', 'threat'] 
        ],
        p:[ 
            ['black_large_square'], ['success'], ['success'], ['success', 'success'], ['success', 'success'], ['advantage'], ['success', 'advantage'], ['success', 'advantage'], ['success', 'advantage'], ['advantage', 'advantage'], ['advantage', 'advantage'], ['triumphant'] 
        ],
        c:[ 
            ['black_large_square'], ['fail'], ['fail'], ['fail', 'fail'], ['fail', 'fail'], ['threat'], ['threat'], ['fail', 'threat'], ['fail', 'threat'], ['threat', 'threat'], ['threat', 'threat'], ['despair'] 
        ],
        f:[ 
            ['darkside'], ['darkside'], ['darkside'], ['darkside'], ['darkside'], ['darkside'], ['darkside'], ['darkside', 'darkside'], ['lightside'], ['lightside'], ['lightside', 'lightside'], ['lightside', 'lightside'], ['lightside', 'lightside'] 
        ],
    },
    roll: function(client, characters_string){
        var self = this;
        if(characters_string.length > 20){ return 'o máximo número de dados é 20'; }
        var regExp = new RegExp('[' + Object.keys(self.dice).join('') + ']');
        if(!regExp.test(characters_string)){ return 'as letras válidas são ' + Object.keys(self.dice).join('') ; }
        var characters = characters_string.trim().split('');
        var count = { success: 0, advantage_threat: 0, triumph: 0, despair: 0 };
        var result_string = characters.reduce(function(result_string, character){
            if(!self.dice[character]){ return result_string; }
            var random_number = Math.floor(Math.random() * Math.floor(self.dice[character].length));
            var face = self.dice[character][random_number];
            face.map(function(f){
                switch(f){
                    case 'success': count.success ++; break;
                    case 'fail': count.success --; break;
                    case 'advantage': count.advantage_threat ++; break;
                    case 'threat': count.advantage_threat --; break;
                    case 'triumphant': count.triumph ++; count.success ++; break;
                    case 'despair': count.despair ++; count.success --; break;
                }
            });
            var symbols = face.reduce(function(symbols, s){
                return symbols + self.emoji(client, s);
            }, '');
            result_string += `${self.emoji(client, 'dg'+character)}${symbols}  `;
            return result_string;
        }, '');
        if('f'.repeat(characters_string.length) == characters_string){//force dice only 
            return result_string;
        }
        result_string += `\n**`;
        if(count.success == 0){
            result_string += '(failed :black_large_square: ';
        }else if(count.success > 0){
            result_string += '(succeeded ';
            while(count.success > 0){ count.success --; result_string += self.emoji(client, 'success'); }
            result_string += ' ';
        }else if(count.success < 0){
            result_string += '(failed ';
            while(count.success < 0){ count.success ++; result_string += self.emoji(client, 'fail'); }
            result_string += ' ';
        }
        if(count.advantage_threat == 0){
            result_string += 'with no advantages';
        }else if(count.advantage_threat > 0){
            result_string += 'with advantages ';
            while(count.advantage_threat > 0){ count.advantage_threat --; result_string += self.emoji(client, 'advantage'); }
        }else if(count.advantage_threat < 0){
            result_string += 'with threats ';
            while(count.advantage_threat < 0){ count.advantage_threat ++; result_string += self.emoji(client, 'threat'); }
        }
        if(count.triumph > 0 && count.despair){
            result_string += ', triumph ';
            while(count.triumph > 0){ count.triumph --; result_string += self.emoji(client, 'triumphant'); }
            result_string += ' and despair ';
            while(count.despair > 0){ count.despair --; result_string += self.emoji(client, 'despair'); }
            result_string += ')';
        }else if(count.triumph > 0){
            result_string += ' and triumph ';
            while(count.triumph > 0){ count.triumph --; result_string += self.emoji(client, 'triumphant'); }
            result_string += ')';
        }else if(count.despair > 0){
            result_string += ' and despair ';
            while(count.despair > 0){ count.despair --; result_string += self.emoji(client, 'despair'); }
            result_string += ')';
        }else{
            result_string += ')';
        }
        result_string += `**`;
        return result_string;
    },
    emoji: emoji
};
