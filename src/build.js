const webpack = require('webpack');
const inquirer = require('inquirer');
const chalk = require('chalk');
const Spinner = require('cli-spinner').Spinner;
const fs = require('fs-extra');

const findJSONConfigs = require('./util/findRichmediaRC');
const createConfigByRichmediarcList = require('./webpack/config/createConfigByRichmediarcList');
const getNameFromSettings = require('./util/getNameFromSettings');
const getTemplate = require('./util/getBuildTemplate');

module.exports = async function build({
  allConfigsSelector = './**/.richmediarc',
  buildTarget = './build',
  stats = false,
}) {
  const spinner = new Spinner('processing.. %s');
  spinner.setSpinnerString('/-\\|');
  spinner.start();

  const configs = await findJSONConfigs(allConfigsSelector, [
    'settings.entry.js',
    'settings.entry.html',
  ]);

  let answers = {};

  spinner.stop(true);

  if (configs.length === 0) {
    throw new Error('could not find a compatible .richmediarc with entry points configured');
  }

  const questions = [];

  if (configs.length > 1) {
    questions.push({
      type: 'checkbox',
      name: 'build',
      message: 'Please choose the current build to start.',
      choices: [
        { name: 'all', checked: false },
        ...configs.map(({ location }) => ({ name: location, checked: false })),
      ],
      validate: function(answer) {
        if (answer.length < 1) {
          return 'You must choose at least one.';
        }
        return true;
      },
    });
  } else {
    console.log(`${chalk.green('✔')} One config found ${configs[0].location}`);
    answers.build = [configs[0].location];
  }

  // questions.push({
  //   type: 'input',
  //   name: 'buildTarget',
  //   message: 'Please choose build location',
  //   default: './build',
  // });

  answers = {
    ...answers,
    ...(await inquirer.prompt(questions)),
  };

  let configsResult = null;

  if (!answers.build) {
    answers.build = [...configPackages];
  }

  // if (!answers.buildTarget) {
  //   answers.buildTarget = buildTarget;
  // }

  if (answers.build.find(item => item === 'all')) {
    configsResult = configs;
  } else {
    configsResult = configs.filter(config => answers.build.indexOf(config.location) >= 0);
  }

  const result = await createConfigByRichmediarcList(configsResult, {
    mode: 'production',
    stats: stats,
  });

  return new Promise((resolve, reject) => {
    webpack(result).run((err, stats) => {
      if (err) {
        console.error(err.stack || err);
        if (err.details) {
          err.details.forEach((item, index) => {
            console.error(index, item);
          });
        }
        return;
      }

      const info = stats.toJson();

      if (stats.hasErrors()) {
        info.errors.forEach((item, index) => {
          console.log(chalk.red(item));
        });
      }

      if (stats.hasWarnings()) {
        info.warnings.forEach(item => {
          console.log(chalk.green(item));
        });
      }

      resolve();
    });
  }).then(async () => {
    const template = await getTemplate();

    const templateConfig = {
      banner: configsResult.map(item => {
        const name = getNameFromSettings(item);

        return {
          src: `./${name}/`,
          name,
          width: item.data.settings.size.width,
          height: item.data.settings.size.height,
        };
      }),
    };

    fs.outputFile('./build/index.html', template(templateConfig), err => {});
  });
};
