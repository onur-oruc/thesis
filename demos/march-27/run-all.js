// Script to run all demos in sequence
const { execSync } = require('child_process');
const path = require('path');

async function main() {
  console.log("Running all battery passport demos in sequence\n");
  
  const demos = [
    '01-deploy-contracts.js',
    '02-create-battery-nft.js',
    '03-permission-management.js',
    '04-compromised-wallets.js',
    '05-battery-data-updates.js'
  ];
  
  const demoDir = path.join(__dirname);
  
  for (const demo of demos) {
    const demoPath = path.join(demoDir, demo);
    console.log(`\n------------------------------------`);
    console.log(`Running demo: ${demo}`);
    console.log(`------------------------------------\n`);
    
    try {
      execSync(`npx hardhat run ${demoPath}`, { stdio: 'inherit' });
      console.log(`\nSuccessfully completed: ${demo}\n`);
    } catch (error) {
      console.error(`\nError running ${demo}:`);
      console.error(error.message);
      process.exit(1);
    }
  }
  
  console.log("\n====================================");
  console.log("All demos completed successfully!");
  console.log("====================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 