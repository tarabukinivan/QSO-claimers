/* eslint-disable no-console */
import { spawn } from 'child_process';

import inquirer from 'inquirer';

import { SECRET_PHRASE } from '../_inputs/settings/global.js';
import savedBlastModules from '../_outputs/json/blast-saved-modules.json' assert { type: 'json' };
import savedLayerZeroModules from '../_outputs/json/layer-zero-saved-modules.json' assert { type: 'json' };
import savedPolyhedraModules from '../_outputs/json/polyhedra-saved-modules.json' assert { type: 'json' };

const scripts = {
  polyhedra: 'polyhedra',
  layerZero: 'layer-zero',
  blast: 'blast',
};
const aliases = {
  runPolyhedra: '1. Polyhedra',
  runLayerZero: '2. LayerZero',
  runBlast: '3. Blast',

  exit: '0. Выйти',
};

const commandAliases = {
  [aliases.runPolyhedra]: scripts.polyhedra,
  [aliases.runLayerZero]: scripts.layerZero,
  [aliases.runBlast]: scripts.blast,

  [aliases.exit]: 'exit',
};

const getStartMainCommand = async (projectName) => {
  const runMainCommand = 'npm run claimer:main';
  const restartLastMainCommand = 'npm run claimer:restart-last';

  let currentSavedModulesToUse;
  switch (projectName) {
    case scripts.polyhedra:
      currentSavedModulesToUse = savedPolyhedraModules;
      break;
    case scripts.layerZero:
      currentSavedModulesToUse = savedLayerZeroModules;
      break;
    case scripts.blast:
      currentSavedModulesToUse = savedBlastModules;
      break;

    default:
      break;
  }

  let command;
  const isFinished = currentSavedModulesToUse.isFinished;
  if (typeof isFinished === 'boolean' && !isFinished) {
    const startLastScriptMessage = 'Да (восстановить выполнение прошлого скрипта)';
    const choicesQuestion = [
      {
        type: 'list',
        name: 'runMainOrRestartQuestions',
        message: `Предыдущий скрипт не закончил свое выполнение для ${currentSavedModulesToUse.route} роута, продолжить его?`,
        choices: [startLastScriptMessage, 'Нет (выполнить новый скрипт, но база будет очищена)'],
      },
    ];

    const { runMainOrRestartQuestions } = await inquirer.prompt(choicesQuestion);
    const isStartLastScript = runMainOrRestartQuestions === startLastScriptMessage;

    command = isStartLastScript ? restartLastMainCommand : runMainCommand;
  } else {
    command = runMainCommand;
  }

  const secret = await getSecretPhrase();
  return {
    command,
    secret,
    projectName,
  };
};

const getSecretPhrase = async () => {
  const input = {
    type: 'input',
    name: 'secret',
    message: 'Введите секретную фразу для кодирования приватных ключей:',
    validate: (input) => {
      if (input.trim() === '') {
        return 'Secret cannot be empty';
      }
      return true;
    },
  };

  if (SECRET_PHRASE) {
    return SECRET_PHRASE;
  }

  const { secret } = await inquirer.prompt(input);

  return secret;
};

(async () => {
  const aliasChoices = Object.keys(commandAliases);

  const questions = [
    {
      type: 'list',
      name: 'alias',
      message: 'Выберите скрипт для выполнения:',
      choices: aliasChoices,
    },
  ];

  const { alias } = await inquirer.prompt(questions);
  const selectedAlias = alias;
  let selectedCommand = commandAliases[selectedAlias];
  let args = [];

  switch (selectedAlias) {
    case aliases.runPolyhedra: {
      const { command, secret, projectName } = await getStartMainCommand(scripts.polyhedra);
      selectedCommand = command;
      args = [secret, projectName, projectName];
      break;
    }
    case aliases.runLayerZero: {
      const { command, secret, projectName } = await getStartMainCommand(scripts.layerZero);
      selectedCommand = command;
      args = [secret, projectName, projectName];
      break;
    }
    case aliases.runBlast: {
      const { command, secret, projectName } = await getStartMainCommand(scripts.blast);
      selectedCommand = command;
      args = [secret, projectName, projectName];
      break;
    }

    default:
      break;
  }

  const commandProcess = spawn(selectedCommand, args, {
    shell: true,
  });

  // Отображаем вывод команды
  commandProcess.stdout.on('data', (data) => {
    process.stdout.write(data.toString());
  });

  let errorCalled = false;
  // Отображаем ошибки (если есть)
  commandProcess.stderr.on('data', (data) => {
    if (!errorCalled) {
      let errMessage = data.toString();

      if (errMessage.includes('triggerUncaughtException')) {
        errMessage =
          'Unknown error occurred: please, call "tsc" command to see the problem or compare global.js with global.example.js';
      } else {
        errMessage = errMessage
          .split('\n')
          .filter((string) => !!string)
          .at(-1);
      }

      process.stderr.write(
        `\x1b[31m${errMessage}\x1b[0m
`
      );
      errorCalled = true;
    }
  });

  // Завершаем выполнение команды и выводим код завершения
  commandProcess.on('close', (code) => {
    if (code === 0) {
      console.log(`Скрипт успешно выполнен: ${selectedCommand}`);
    } else {
      console.error(`Ошибка выполнения скрипта: ${selectedCommand}`);
    }
  });
})();
