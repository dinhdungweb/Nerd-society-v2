import fs from 'fs';
import path from 'path';

const IMAGES_DIR = 'src/images';
const SRC_DIR = 'src';

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function findUnused() {
  const allImages = getAllFiles(IMAGES_DIR).filter(f => /\.(png|jpg|jpeg|svg|webp)$/i.test(f));
  const allSrcFiles = getAllFiles(SRC_DIR).filter(f => /\.(ts|tsx|js|jsx|json)$/i.test(f));
  
  const srcContents = allSrcFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  
  const unused = allImages.filter(img => {
    const fileName = path.basename(img);
    return !srcContents.includes(fileName);
  });

  console.log('--- DANH SÁCH ẢNH KHÔNG ĐƯỢC SỬ DỤNG ---');
  unused.forEach(img => console.log(img));
  console.log('---------------------------------------');
  console.log(`Tổng cộng: ${unused.length} file không dùng.`);
}

findUnused();
