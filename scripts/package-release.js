import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pluginName = 'suggestme-decky-plugin';

// 0. Version consistency check
console.log('🔍 Checking version consistency...');
const pluginJsonPath = path.join(rootDir, 'plugin.json');
const packageJsonPath = path.join(rootDir, 'package.json');

const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (pluginJson.version !== packageJson.version) {
    console.error(`Version mismatch detected!`);
    console.error(`   plugin.json:  ${pluginJson.version}`);
    console.error(`   package.json: ${packageJson.version}`);
    console.error(`   Please ensure both files have the same version.`);
    process.exit(1);
}
console.log(`   Version ${pluginJson.version} is consistent`);

const version = pluginJson.version;
const releaseDir = path.join(rootDir, 'release');
const tempDir = path.join(releaseDir, pluginName);
const zipFile = path.join(releaseDir, `${pluginName}-v${version}.zip`);

console.log(` Packaging release for ${pluginName} v${version}`);

// 1. Build
console.log('  Building project...');
try {
    execSync('pnpm run build', { stdio: 'inherit', cwd: rootDir });
} catch (e) {
    console.error(' Build failed. Please check the output above.');
    process.exit(1);
}

// 2. Prepare Release Directory
console.log(' Preparing release directory...');
if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// 3. Copy Files
const filesToCopy = [
    'dist',
    'assets',
    'plugin.json',
    'main.py',
    'requirements.txt',
    'package.json',
    'README.md',
    'LICENSE'
];

filesToCopy.forEach(file => {
    const src = path.join(rootDir, file);
    const dest = path.join(tempDir, file);

    if (fs.existsSync(src)) {
        if (fs.statSync(src).isDirectory()) {
            fs.cpSync(src, dest, { recursive: true });
        } else {
            fs.copyFileSync(src, dest);
        }
        console.log(`   - Copied ${file}`);
    } else {
        console.warn(`     Warning: ${file} not found.`);
    }
});

// 4. Create Zip
console.log(' Creating zip file...');
try {
    // Using native 'zip' command, which is available in WSL/Linux
    execSync(`zip -r "${zipFile}" "${pluginName}"`, { stdio: 'inherit', cwd: releaseDir });
    console.log('');
    console.log(' Release package created successfully!');
    console.log(` Location: ${zipFile}`);
} catch (e) {
    console.error(' Failed to create zip file.');
    console.error('Make sure "zip" is installed (sudo apt install zip)');
    process.exit(1);
}
