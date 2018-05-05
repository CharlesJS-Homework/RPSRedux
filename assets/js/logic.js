/* eslint-env browser, jquery, firebase, es6 */

const config = {
  apiKey: 'AIzaSyB9Xo5TXvRqwQ5Ak7WfiZdyLdaMz8XcHWw',
  authDomain: 'rpsgame-ff934.firebaseapp.com',
  databaseURL: 'https://rpsgame-ff934.firebaseio.com',
  projectId: 'rpsgame-ff934',
  storageBucket: '',
  messagingSenderId: '140084134892',
};

firebase.initializeApp(config); // eslint-disable-line no-undef

const database = firebase.database(); // eslint-disable-line no-undef

const playersRef = database.ref().child('players');
const chatRef = database.ref().child('chat');

const chatMsgs = [];

const players = {};
const choices = {};
let playerName;
let playerNum;
let turnNum;

$(document).ready(() => {
  setUpPlayerBoxes();

  $('#status-header, .chosen, .rps-choices').hide();

  $('#name-form').on('submit', chooseName);

  $('#chat-form > input').prop('disabled', true);
  $('#chat-form').on('submit', sendMessage);

  setUpDBBindings();
});

function setUpPlayerBoxes() {
  const name = $('<h2>').attr('class', 'player-name-header');
  const chosen = $('<h2 class="chosen">');

  const rpsBox = $('<ul class="rps-choices">').append(['rock', 'paper', 'scissors'].map(each => $('<li class="rps-choice">').attr('data-choice', each).text(each.charAt(0).toUpperCase() + each.slice(1)).on('click', choose)));

  const winLoss = $('<h3 class="win-loss">Wins: <span class="wins">0</span> Losses: <span class="losses">0</span></h3>');

  $('.game-box-player').append([name, chosen, rpsBox, winLoss]);
}

function setUpDBBindings() {
  for (let i = 1; i <= 2; i++) {
    const player = playersRef.child(i);
    const box = $(`.game-box-player[data-player="${i}"]`);

    player.on('value', (snapshot) => {
      const val = snapshot.val();

      const alreadyRunning = (players[1] && players[2] && playerNum);

      if (val) {
        if (!players[i]) {
          players[i] = {};
        }

        if (val.name) {
          players[i].name = val.name.slice();
        }

        if (val.choice) {
          players[i].choice = val.choice.slice();
        }
      } else {
        delete players[i];
      }

      if (players[1] && players[2] && playerNum) {
        if (!alreadyRunning) {
          startGame();
        }
      } else {
        stopGame();
      }
    });

    player.child('name').on('value', (snapshot) => {
      const val = snapshot.val() ? snapshot.val() : `Waiting for Player ${i}…`;
      box.find('.player-name-header').text(val);
    });

    player.child('wins').on('value', (snapshot) => {
      box.find('.win-loss > .wins').text(snapshot.val());
    });

    player.child('losses').on('value', (snapshot) => {
      box.find('.win-loss > .losses').text(snapshot.val());
    });

    player.child('choice').on('value', (snapshot) => {
      choices[i] = snapshot.val();

      if (turnNum && players[turnNum]) {
        if (turnNum === 1) {
          turnNum = 2;
          updateGame();
        } else {
          endGame();
        }
      }
    });
  }

  chatRef.orderByChild('timestamp').on('child_added', (snapshot) => {
    const val = snapshot.val();
    const msg = val.name ? `${val.name}: ${val.msg}` : val.msg;

    $('#chat-box').append($('<li>').text(msg));

    chatMsgs.push(snapshot.ref);

    while (chatMsgs.length > 10) {
      chatMsgs[0].remove();
      chatMsgs.splice(0, 1);
      $('#chat-box').find(':first-child').remove();
    }
  });
}

function startGame() {
  turnNum = 1;
  updateGame();
}

function stopGame() {
  turnNum = undefined;
  updateGame();
}

function updateGame() {
  updateChoices();

  $('.game-box-player-turn').removeClass('game-box-player-turn');
  $('.rps-choices').hide();

  if (turnNum) {
    $(`.game-box-player[data-player="${turnNum}"]`).addClass('game-box-player-turn');

    if (turnNum === playerNum) {
      const playerBox = $(`.game-box-player[data-player="${playerNum}"]`);

      playerBox.find('.chosen').hide();
      playerBox.find('.rps-choices').show();

      $('#turn').text("It's Your Turn!");
    } else {
      $('#turn').text(`Waiting for ${players[turnNum].name} to choose`);
    }
  }
}

function endGame() {
  updateChoices();

  $('.rps-choices').hide();
  $('.chosen').show();

  const p1Choice = choices[1];
  const p2Choice = choices[2];

  if (p1Choice === p2Choice) {
    draw();
    return;
  }

  switch (p1Choice) {
    case 'rock':
      win(p2Choice === 'scissors' ? 1 : 2);
      break;
    case 'paper':
      win(p2Choice === 'rock' ? 1 : 2);
      break;
    case 'scissors':
      win(p2Choice === 'paper' ? 1 : 2);
      break;
    default:
      break;
  }
}

function win(whichPlayer) {
  $('#status-heading').text(whichPlayer === playerNum ? 'You Win!' : 'You Lose!');

  const winner = playersRef.child(whichPlayer);
  const loser = playersRef.child(whichPlayer === 1 ? 2 : 1);

  winner.child('wins').transaction((wins) => {
    if (wins) {
      return wins + 1;
    }

    return 1;
  });

  loser.child('losses').transaction((losses) => {
    if (losses) {
      return losses + 1;
    }

    return 1;
  });
}

function draw() {
  $('#status-heading').text('A Tie!');
}

function updateChoices() {
  for (let i = 1; i <= 2; i++) {
    const playerBox = $(`.game-box-player[data-player="${i}"]`);
    const choice = choices[i];

    if (choice) {
      playerBox.find('.chosen').text(choice.charAt(0).toUpperCase() + choice.slice(1));
    }
  }
}

function chooseName(event) {
  event.preventDefault();

  const name = $('#name-field').val();

  if (!name || name.length === 0) {
    return;
  }

  playerName = name;

  chatRef.push().set({
    msg: `${playerName} Joined`,
    timestamp: firebase.database.ServerValue.TIMESTAMP, // eslint-disable-line no-undef
  });

  for (let i = 1; i <= 2; i++) {
    if (!players[i]) {
      playerNum = i;

      const playerRef = playersRef.child(i);

      playerRef.set({
        name: playerName,
        wins: 0,
        losses: 0,
      });

      chatRef.push().onDisconnect().set({
        msg: `${playerName} Disconnected`,
        timestamp: firebase.database.ServerValue.TIMESTAMP, // eslint-disable-line no-undef
      });

      playerRef.onDisconnect().remove();
      $('#name-form').hide();

      $('#player-name').text(playerName);
      $('#player-number').text(playerNum);
      $('#status-header').show();
      $('#chat-form > input').prop('disabled', false);

      break;
    }
  }
}

function choose() {
  if (!turnNum) {
    return;
  }

  const playerBox = $(`.game-box-player[data-player="${playerNum}"]`);

  playerBox.find('.rps-choices').hide();
  playerBox.find('.chosen').show();

  playersRef.child(playerNum).child('choice').set($(this).attr('data-choice'));
}

function sendMessage(event) {
  event.preventDefault();

  const msg = $('#chat-field').val();

  chatRef.push().set({
    name: playerName,
    msg,
    timestamp: firebase.database.ServerValue.TIMESTAMP, // eslint-disable-line no-undef
  });

  $('#chat-field').val('');
}
