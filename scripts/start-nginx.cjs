const { exec } = require("child_process");

const isWindows = process.platform === "win32";
const cmd = isWindows
  ? "nginx -p . -c nginx.conf"
  : "./scripts/start-nginx.sh"; // 若 Linux 繼續用 .sh 檔

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ 執行錯誤: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`⚠️ stderr: ${stderr}`);
    return;
  }
  console.log(`✅ stdout: ${stdout}`);
});