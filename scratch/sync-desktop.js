const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const destinations = [
  '/home/hussein/Desktop/ArzMart_Latest',
  '/home/hussein/Desktop/ArzMart_Final',
  '/home/hussein/Desktop/Arz-Mart',
  '/home/hussein/Desktop/arzmart'
];

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const curPath = path.join(directoryPath, file);
      try {
        const stat = fs.statSync(curPath);
        if (stat.isDirectory()) {
          deleteFolderRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      } catch (err) {
        // If stat fails (e.g. broken symlink), just unlink it
        try {
          fs.unlinkSync(curPath);
        } catch (e) {}
      }
    });
    try {
      fs.rmdirSync(directoryPath);
    } catch (e) {}
  }
}

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((element) => {
    // Avoid copying node_modules or database.sqlite backups in backend if any
    if (element === 'node_modules' || element === '.git' || element === 'database.sqlite') {
      return;
    }
    
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    try {
      const stat = fs.statSync(fromPath);
      if (stat.isDirectory()) {
        copyFolderSync(fromPath, toPath);
      } else {
        fs.copyFileSync(fromPath, toPath);
      }
    } catch (err) {
      console.warn(`Warning: Could not copy ${fromPath}: ${err.message}`);
    }
  });
}

function syncAll() {
  console.log('--- Step 1: Building Frontend ---');
  try {
    execSync('npm run build', { cwd: path.join(workspaceRoot, 'frontend'), stdio: 'inherit' });
    console.log('Frontend built successfully!');
  } catch (err) {
    console.error('Error building frontend:', err.message);
    process.exit(1);
  }

  console.log('\n--- Step 2: Synchronizing Files ---');
  
  const foldersToSync = [
    { src: 'backend', destSub: 'backend' },
    { src: 'frontend/src', destSub: 'frontend/src' },
    { src: 'frontend/dist', destSub: 'frontend/dist' },
    { src: 'frontend/public', destSub: 'frontend/public' }
  ];

  const filesToSync = [
    { src: 'frontend/package.json', destSub: 'frontend/package.json' },
    { src: 'frontend/package-lock.json', destSub: 'frontend/package-lock.json' },
    { src: 'frontend/vite.config.js', destSub: 'frontend/vite.config.js' },
    { src: 'frontend/index.html', destSub: 'frontend/index.html' },
    { src: 'README.md', destSub: 'README.md' },
    { src: '.gitignore', destSub: '.gitignore' }
  ];

  for (const dest of destinations) {
    console.log(`\nSyncing to: ${dest}`);
    if (!fs.existsSync(dest)) {
      console.log(`Destination path does not exist: ${dest}. Creating...`);
      fs.mkdirSync(dest, { recursive: true });
    }

    // Copy/Sync directories
    for (const folder of foldersToSync) {
      const srcPath = path.join(workspaceRoot, folder.src);
      const destPath = path.join(dest, folder.destSub);

      if (fs.existsSync(srcPath)) {
        console.log(`  Copying directory: ${folder.src} -> ${folder.destSub}`);
        // Clean up destination directory first to avoid old files remaining
        if (fs.existsSync(destPath)) {
          deleteFolderRecursive(destPath);
        }
        copyFolderSync(srcPath, destPath);
      }
    }

    // Copy single files
    for (const file of filesToSync) {
      const srcPath = path.join(workspaceRoot, file.src);
      const destPath = path.join(dest, file.destSub);

      if (fs.existsSync(srcPath)) {
        console.log(`  Copying file: ${file.src} -> ${file.destSub}`);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  console.log('\nSynchronization completed successfully for all 4 Desktop folders!');
}

syncAll();
