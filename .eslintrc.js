module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true,
        "jquery": true
    },
    "globals": {
        "moment": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
        "no-console": 0,
        "indent": [
            "error",
            4
        ],
        "semi": [
            "error",
            "always"
        ]
    }
};