const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
  // Root directory to scan
  rootDir: process.cwd(),
  // Folders to exclude
  excludeFolders: ['node_modules', '.git', '.nuxt', 'public'],
  // File extensions to exclude
  excludeExtensions: ['.jpg', '.png', '.gif', '.pdf', '.zip'],
  // Specific files to exclude
  excludeFiles: ['pnpm-lock.yaml', 'yarn.lock', '.gitignore', 'bundle_output.txt', 
    'README.md', 'yarn.lock', 'firebase.js', 'bundleFiles.cjs'],
  // Output file path
  outputFile: 'bundle_output.txt'
};

async function bundleFiles() {
  try {
    // Initialize output content
    let outputContent = '';

    // Recursive function to scan directories
    async function scanDirectory(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip excluded folders
        if (entry.isDirectory() && config.excludeFolders.includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(fullPath);
        } else {
          // Check for excluded files and extensions
          if (config.excludeFiles.includes(entry.name) ||
              config.excludeExtensions.includes(path.extname(entry.name).toLowerCase())) {
            continue;
          }

          try {
            // Read file content
            const content = await fs.readFile(fullPath, 'utf8');
            
            // Calculate relative path from root directory
            const relativePath = path.relative(config.rootDir, fullPath);
            
            // Add file content to output with header
            outputContent += `### ${relativePath} ###\n\n${content}\n\n`;
          } catch (err) {
            console.error(`Error reading file ${fullPath}:`, err.message);
          }
        }
      }
    }

    // Start scanning from root directory
    await scanDirectory(config.rootDir);

    // Write output to file
    await fs.writeFile(config.outputFile, outputContent);
    console.log(`Bundle created successfully at ${config.outputFile}`);
    
  } catch (err) {
    console.error('Error during bundling:', err.message);
  }
}

// Run the bundling process
bundleFiles();