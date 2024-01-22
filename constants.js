const GAME_INFO = {
    LIFE: {
        1: 2,
        2: 4,
        3: 6,
        4: 1,
    },
    ROUNDS: 3,
    STARTING_ROUND: 1,
}

const ROUND_CHAMBERS = {
    1: [1],
    2: [2, 3, 4],
    3: [4, 5],
    4: [],
}

const PERKS = [
    "DOUBLE DAMAGE💥",
    "EXTRA LIFE❤️‍🩹",
    "DISCARD SHELL🗑️",
    "EXTRA TURN🔁",
    "NEXT IN CHAMBER🔍",
    "LIFE FOR PERK💘",
]

module.exports = {
    GAME_INFO,
    ROUND_CHAMBERS,
    PERKS,
}