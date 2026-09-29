/** app.json plus the version, which lives only in package.json (`npm run bump`). */
module.exports = ({ config }) => ({
    ...config,
    version: require("./package.json").version,
});
