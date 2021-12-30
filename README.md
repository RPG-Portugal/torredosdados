![Torre dos Dados](https://rpgportugal.com/torres/img/torredosdados.jpg)

# Torre dos Dados
*Bota do servidor RPG Portugal no Discord. Faz parte de um projecto mais alargado de desenvolvimento de soluções para a comunidade de roleplayers Portuguesa. Mais informação [na respectiva página](https://rpgportugal.com/torre/).*

### Criar novos comandos
Se quiseres criar um novo comando para o servidor, podes ver como são estruturados no ficheiro commands. Todos os comandos usados publicamente estão em Português. São funções que recebem um array de argumentos, o [member](https://discord.js.org/#/docs/main/stable/class/GuildMember) que escreveu o comando e o [channel](https://discord.js.org/#/docs/main/stable/class/TextChannel) onde o comando foi escrito. Devolvem uma string que é publicada no canal junto com o username de quem escreveu o comando. Se excepcionalmente precisares que a tua função seja assíncrona, vê o caso do comando copia. Retornas false para à partida não dizer nada e depois tratas de responder directamente no canal. Se quiseres usar um emoji do servidor (nomeadamente os dados que são designados por `d4`, `d6`, `d8`, etc.) podes ver que é necessário obter um identificador através do método tools.emoji que recebe o client ligado ao Discord e o nome do emoji (ex: `tools.emoji(client, "d20")`).

### Onde está o model.json
É um ficheiro de configuração que inclui o token secreto da bota. O objecto inclui esse `token`, o `sqlite_path` para a base de dados, o `guild_id`do servidor RPG Portugal, o `user_id` de quem tem acesso a todos os comandos da bota, um array de IDs dos `admins`, etc. Em `log` ficam os dados relativos a um outro servidor que é usado para facilitar o debug dos vários comandos. À medida que este objecto cresce, parte dele já foi substituída por uma tabela na base de dados.

### Issues e Pull requests 
A bota só faz sentido no único servidor para o qual ela foi criada, pelo que o seu desenvolvimento pode ser trabalhado participando no https://rpgportugal.com/, nomeadamente no canal #oficina-dos-givHackers. Obrigado pelo teu interesse! 

### Mas como é que faço um pull request (pedido de alteração)?
Podes ver [aqui no repositório da Gazeta do RPG Portugal](https://github.com/RPG-Portugal/gazeta) como se faz, é igual para todos. Em caso de dúvida, contacta o dreamup#1404 no Discord.

### Só sei HTML/CSS, posso ajudar de alguma maneira?
Sim! O guia de utilização da bota está [aqui](https://github.com/RPG-Portugal/landingpagesrpgpt) e o respectivo repositório encontra-se [aqui](https://github.com/RPG-Portugal/landingpagesrpgpt).
