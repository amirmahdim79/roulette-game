const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { generateId, LOG_LOBBIES_INFO, restartGame, gameInfo, randomTurn, createChamber, getRandomIndex, getRandomElement, generatePerks, getPlayers } = require('./utils');
const cors = require('cors');
const { GAME_INFO, PERKS } = require('./constants');

const app = express();
app.use(cors())

const server = http.createServer(app);
const io = new Server(server, {
    path: '/api-roulette',
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
    rememberUpgrade: true,
});

app.get('/test', (req, res) => {
    res.send('THIS IS A TEST')
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/static/index.html');
});

app.get('/lobby', (req, res) => {
    res.sendFile(__dirname + '/static/lobby.html');
});

const lobbies = {};

io.use((socket, next) => {
    // const username = socket.handshake.auth.username;

    // if (!username) {
    //     return next(new Error('Invalid username'));
    // }

    socket.userId = generateId();
    // socket.username = username;

    next();
});

io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle game logic here
    socket.on('joinLobby', (data) => {
        const requestedLobbyId = data.lobbyId;
        // const username = socket.username
        const playerId = socket.userId

        let lobby = lobbies[requestedLobbyId]

        if (!lobby) {
            lobby = {
                id: generateId(),
                round: GAME_INFO.STARTING_ROUND,
                isStarted: false,
                players: [
                    {
                        id: playerId,
                        socket,
                        life: GAME_INFO.LIFE[1],
                        perks: [],
                        activePerks: [],
                        isAdmin: true,
                        score: 0,
                    },
                ]
            }
            lobbies[lobby.id] = lobby
        } else {
            if (lobby.players.length >= 2) {
                socket.emit('lobbyFull');
                return;
            }
            lobby.players.push({
                id: playerId,
                socket,
                life: GAME_INFO.LIFE[1],
                perks: [],
                activePerks: [],
                isAdmin: false,
                score: 0,
            })
        }

        // Notify the client about successful lobby join
        socket.emit('lobbyJoined', gameInfo(lobby, playerId));
        LOG_LOBBIES_INFO(lobbies)

        // Notify other players in the lobby about the new player
        lobby.players.forEach((player) => {
            if (player.socket !== socket) {
                player.socket.emit('opponentJoined', gameInfo(lobby, player.id));
            }
        });

        socket.on('sendLobbyInfo', () => {
            console.log(gameInfo(lobby, playerId))
            socket.emit('lobbyInfo', gameInfo(lobby, playerId))
        })

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('A user disconnected');
            console.log(lobby)

            const updatedPlayers = lobby.players.filter((p) => {
                return p.socket !== socket
            })

            lobby.players = updatedPlayers

            const opponent = updatedPlayers[0]
            if (opponent) {
                opponent.isAdmin = true
                restartGame(lobby)
                opponent.socket.emit('opponentLeft', gameInfo(lobby, opponent.id));
            }

            if (lobby.players.length <= 0) {
                console.log('deleted lobby: ', lobby.id)
                delete lobbies[lobby.id]
                LOG_LOBBIES_INFO(lobbies)
            }
        });

        // Handle game events
        socket.on('start', (data) => {
            if (lobby.players.length === 2) {
                lobby.isStarted = true
                lobby.turn = lobby.players[randomTurn()].id
                lobby.chamber = createChamber(lobby.round)
                lobby.nextInChamber = getRandomIndex(lobby.chamber)
                lobby.players.forEach((player) => {
                    player.socket.emit('turn', gameInfo(lobby, player.id))
                })
            }
        });

        socket.on('turn', (data) => {
            const move = data.move //shootOpp | shootMe
            const perk = data.perk
            const nextInChamber = lobby.nextInChamber
            const bullet = lobby.chamber[nextInChamber]

            let player = {}
            let opponent = {}

            lobby.players.forEach((p) => {
                if (p.socket === socket) {
                    player = p
                } else {
                    opponent = p
                }
            })

            const hasDoubleDamage = player.activePerks.includes("DOUBLE DAMAGE💥")
            const hasExtraTurn = player.activePerks.includes("EXTRA TURN🔁")
            
            if (move === 'shootMe') {
                if (bullet) {
                    player.life -= hasDoubleDamage ? 2 : 1
                    lobby.turn = hasExtraTurn ? player.id : opponent.id
                    player.socket.emit('message', { message: "You SHOT yourself" })
                    opponent.socket.emit('message', { message: "Opponent SHOT themself" })
                } else {
                    player.socket.emit('message', { message: "It was a BLANK" })
                    opponent.socket.emit('message', { message: "It was a BLANK" })
                }
                
            } else if (move === 'shootOpp') {
                if (bullet) {
                    opponent.life -= hasDoubleDamage ? 2 : 1
                    player.socket.emit('message', { message: "You SHOT the OPPONENT" })
                    opponent.socket.emit('message', { message: "Opponent SHOT you" })
                } else {
                    player.socket.emit('message', { message: "It was a BLANK" })
                    opponent.socket.emit('message', { message: "It was a BLANK" })
                }

                lobby.turn = hasExtraTurn ? player.id : opponent.id
            }

            if (hasDoubleDamage) {
                player.activePerks = player.activePerks.filter(perk => perk !== "DOUBLE DAMAGE💥")
            }
            if (hasExtraTurn) {
                player.activePerks = player.activePerks.filter(perk => perk !== "EXTRA TURN🔁")
            }

            lobby.chamber.splice(nextInChamber, 1);

            lobby.nextInChamber = getRandomIndex(lobby.chamber)
            
            const player_died = player.life <= 0
            const opponent_died = opponent.life <= 0

            if (player_died || opponent_died) {
                lobby.round += 1
                lobby.players.forEach((player) => {
                    player.socket.emit('message', { message: "--NEXT ROUND--" })
                })
                player.life = GAME_INFO.LIFE[lobby.round]
                player.activePerks = []
                opponent.life = GAME_INFO.LIFE[lobby.round]
                opponent.activePerks = []
                lobby.chamber = createChamber(lobby.round)
                lobby.nextInChamber = getRandomIndex(lobby.chamber)

                if (player_died) opponent.score += 1
                if (opponent_died) player.score += 1

                if (lobby.round > 1) {
                    generatePerks(lobby.round, player, opponent)
                }
            }

            if (lobby.round >= 4) {
                lobby.players.forEach((player) => {
                    player.socket.emit('end', { message: "GOOD GAME", winner: player_died ? opponent.id : player.id })
                })
            }

            if (lobby.chamber.length <= 0) {
                lobby.chamber = createChamber(lobby.round)
                lobby.nextInChamber = getRandomIndex(lobby.chamber)

                if (lobby.round > 1) {
                    generatePerks(lobby.round, player, opponent)
                }
            }

            lobby.players.forEach((player) => {
                player.socket.emit('turn', gameInfo(lobby, player.id))
            })
        });

        socket.on('perk', (data) => {
            const perkIndex = data.perkIndex
            let exists = false

            const { player, opponent } = getPlayers(lobby, socket)

            const perk = player.perks[perkIndex]

            if (perk === "EXTRA LIFE❤️‍🩹") {
                player.socket.emit('message', { message: "Extra life added" })
                opponent.socket.emit('message', { message: "Opponent added an extra life" })
                player.life += 1
            }

            else if (perk === "NEXT IN CHAMBER🔍") {
                player.socket.emit('message', { message: `Next round is ${lobby.chamber[lobby.nextInChamber] ? 'LIVE' : 'BLANK'}` })
                opponent.socket.emit('message', { message: "Opponent saw the next round" })
            }

            else if (perk === "DOUBLE DAMAGE💥") {
                if (player.activePerks.includes(perk)) {
                    exists = true
                    player.socket.emit('message', { message: `Already activated` })
                } else {
                    player.activePerks.push(perk)
                    player.socket.emit('message', { message: `Double damage activated` })
                    opponent.socket.emit('message', { message: "Opponent has double damage" })
                }
            }

            else if (perk === "EXTRA TURN🔁") {
                if (player.activePerks.includes(perk)) {
                    exists = true
                    player.socket.emit('message', { message: `Already activated` })
                } else {
                    player.activePerks.push(perk)
                    player.socket.emit('message', { message: `Extra turn activated` })
                    opponent.socket.emit('message', { message: "Opponent has extra turn" })
                }
            }

            else if (perk === "LIFE FOR PERK💘") {
                player.life -= 1
                const perk = getRandomElement(PERKS)
                player.perks.push(perk)
                player.socket.emit('message', { message: `Gave life for ${perk}` })
                opponent.socket.emit('message', { message: `Opponent gave life for ${perk}` })
            }

            else if (perk === "DISCARD SHELL🗑️") {
                player.socket.emit('message', { message: `Discarded ${lobby.chamber[lobby.nextInChamber] ? 'LIVE' : 'BLANK'}` })
                opponent.socket.emit('message', { message: `Opponent discarded ${lobby.chamber[lobby.nextInChamber] ? 'LIVE' : 'BLANK'}` })
                
                lobby.chamber.splice(lobby.nextInChamber, 1);
                lobby.nextInChamber = getRandomIndex(lobby.chamber)
            }

            if (!exists) player.perks.splice(perkIndex, 1);

            lobby.players.forEach((player) => {
                player.socket.emit('update', gameInfo(lobby, player.id))
            })
        })

        socket.on('restart', (data) => {
            restartGame(lobby)
            console.log('GAME RESTARTED')
            console.log(lobby)

            lobby.players.forEach((player) => {
                player.socket.emit('restart', gameInfo(lobby, player.id))
            })
            
        });
    });
});

// io.listen(3003)

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
