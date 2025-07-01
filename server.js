const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = {};
let board = Array(9).fill(null);
let currentPlayer = "X";
let gameActive = true;

io.on("connection", (socket) => {
    console.log("Un joueur s'est connecté :", socket.id);

    // Gérer le choix du symbole
    socket.on("chooseSymbol", (symbol) => {
        if (Object.keys(players).length >= 2) {
            socket.emit("full");
            socket.disconnect();
            return;
        }

        // Vérifier si le symbole est disponible
        const symbolsInUse = Object.values(players);
        if (symbolsInUse.includes(symbol)) {
            socket.emit("symbolTaken");
            return;
        }

        // Assigner le symbole au joueur
        players[socket.id] = symbol;
        socket.emit("playerType", symbol);

        // Si deux joueurs sont connectés, commencer le jeu
        if (Object.keys(players).length === 2) {
            io.emit("updateBoard", board, currentPlayer);
        }
    });

    // Gérer les mouvements des joueurs
    socket.on("play", (index) => {
        if (!gameActive || players[socket.id] !== currentPlayer || board[index] !== null) {
            return; // Ignorer si ce n'est pas le tour du joueur ou si la case est déjà occupée
        }

        // Mettre à jour le plateau
        board[index] = currentPlayer;
        io.emit("updateBoard", board, currentPlayer === "X" ? "O" : "X");

        // Vérifier s'il y a un gagnant ou un match nul
        const winner = checkWinner();
        if (winner) {
            gameActive = false;
            io.emit("gameOver", winner);
        } else if (board.every(cell => cell !== null)) {
            gameActive = false;
            io.emit("gameOver", "draw");
        } else {
            // Changer de joueur
            currentPlayer = currentPlayer === "X" ? "O" : "X";
        }
    });

    // Gérer la réinitialisation du jeu
    socket.on("reset", () => {
        board = Array(9).fill(null);
        currentPlayer = "X";
        gameActive = true;
        io.emit("resetGame");
    });

    // Gérer la déconnexion d'un joueur
    socket.on("disconnect", () => {
        console.log("Un joueur s'est déconnecté :", socket.id);
        delete players[socket.id];

        // Réinitialiser le jeu si un joueur se déconnecte
        board = Array(9).fill(null);
        currentPlayer = "X";
        gameActive = true;
        io.emit("resetGame");

        // Si un seul joueur reste, le notifier
        if (Object.keys(players).length === 1) {
            const remainingPlayerId = Object.keys(players)[0];
            io.to(remainingPlayerId).emit("status", "En attente d'un nouvel adversaire...");
        }
    });
});

// Vérifier s'il y a un gagnant
function checkWinner() {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Lignes
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colonnes
        [0, 4, 8], [2, 4, 6]             // Diagonales
    ];

    for (const combination of winningCombinations) {
        const [a, b, c] = combination;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // Retourne le gagnant (X ou O)
        }
    }
    return null; // Pas de gagnant
}

// Servir les fichiers statiques
app.use(express.static("public"));

// Démarrer le serveur
server.listen(3000, () => {
    console.log("Serveur démarré sur http://0.0.0.0:3000");
});