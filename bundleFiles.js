const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
  rootDir: '.', // Project root directory
  outputFile: 'bundled_output.txt', // Output file name
  excludeDirs: ['node_modules', '.git', 'dist', 'build'], // Folders to exclude
  excludeExtensions: ['.jpg', '.png', '.gif', '.bin', '.exe'], // File extensions to exclude
};

// Function to check if a file or directory should be excluded
function shouldExclude(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  return config.excludeDirs.includes(fileName) || config.excludeExtensions.includes(ext);
}

// Function to recursively scan directories and collect file contents
async function scanDirectory(dir, relativePath = '') {
  let output = '';
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativeFilePath = path.join(relativePath, entry.name);

    if (shouldExclude(fullPath)) {
      continue; // Skip excluded directories or files
    }

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      output += await scanDirectory(fullPath, relativeFilePath);
    } else if (entry.isFile()) {
      // Read and append file contents
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        output += `### ${relativeFilePath} ###\n\n${content}\n\n`;
      } catch (err) {
        console.error(`Error reading file ${relativeFilePath}:`, err.message);
      }
    }
  }

  return output;
}

// Main function to bundle files
async function bundleFiles() {
  try {
    console.log('Scanning project directory...');
    const outputContent = await scanDirectory(config.rootDir);

    // Write to output file
    await fs.writeFile(config.outputFile, outputContent);
    console.log(`Bundled files successfully written to ${config.outputFile}`);
  } catch (err) {
    console.error('Error bundling files:', err.message);
  }
}

// Run the program
bundleFiles();