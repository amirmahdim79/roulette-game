const { GAME_INFO, ROUND_CHAMBERS, PERKS } = require("./constants");
const _ = require('lodash');

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

const LOG_LOBBIES_INFO = (lobbies) => {
    console.log('\n')
    console.log("==================================================")
    console.log("==================================================")
    console.log('\n')
    console.log(Object.keys(lobbies).length, 'lobbies')
    console.log('\n')
    console.log('lobbies:', lobbies)
    console.log('\n')
    console.log("==================================================")
    console.log("==================================================")
    console.log('\n')
}

const restartGame = (lobby) => {
    lobby.isStarted = false
    lobby.round = GAME_INFO.STARTING_ROUND
    lobby.players.forEach(p => {
        p.life = GAME_INFO.LIFE[1]
        p.perks = []
        p.activePerks = []
        p.score = 0
    })
}

const gameInfo = (lobby, playerId) => {
    return {
        ..._.omit(lobby, ['players', 'nextInChamber']),
        playerId,
        players: lobby.players.map(p => 
            _.omit(p, 'socket')
        )
    }
}

const randomTurn = () => {
    return Math.floor(Math.random() * 2);
}

function getRandomElement(arr) {
    // Check if the array is empty
    if (arr.length === 0) {
      return undefined; // or handle as needed
    }
  
    // Generate a random index within the array length
    const randomIndex = Math.floor(Math.random() * arr.length);
  
    // Return the element at the randomly chosen index
    return arr[randomIndex];
}

function getRandomIndex(arr) {
    if (!arr.length) {
        return null; // Return null for an empty array
    }

    const randomIndex = Math.floor(Math.random() * arr.length);
    return randomIndex;
}
  

const createChamber = (round = 1) => {
    let length = round * 3
    let chamber = Array(length).fill(0);
    let shots = getRandomElement(ROUND_CHAMBERS[round])

    for (let i = 0; i < shots; i++) {
        let randomIndex;
        
        do {
          randomIndex = Math.floor(Math.random() * length);
        } while (chamber[randomIndex] === 1);
    
        chamber[randomIndex] = 1;
    }

    return chamber
}

const generatePerks = (round, player, opponent) => {
    let max_perks = round === 2 ? 2 : 4
    player.perks = []
    opponent.perks = []
    for (i = 0; i < max_perks; i++) {
        player.perks.push(getRandomElement(PERKS))
        opponent.perks.push(getRandomElement(PERKS))
    }
}

const getPlayers = (lobby, socket) => {
    let player = {}
    let opponent = {}

    lobby.players.forEach((p) => {
        if (p.socket === socket) {
            player = p
        } else {
            opponent = p
        }
    })

    return { player, opponent }
}


module.exports = {
    generateId,
    LOG_LOBBIES_INFO,
    restartGame,
    gameInfo,
    randomTurn,
    createChamber,
    getRandomIndex,
    getRandomElement,
    generatePerks,
    getPlayers,
}