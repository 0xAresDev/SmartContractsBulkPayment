# ForumAI Smart Contract Hardhat Project
For configuration, please make a copy of `.env.example` to a `.env` file

### Compile smart contracts
```shell
npx hardhat compile
```

### Running test
```shell
REPORT_GAS=true npx hardhat test
```

### Deploying smart contracts

```shell
npx hardhat run scripts/deploy.ts --network skale_titan_test
```
You can add more networks as you need in the `hardhat.config.ts` file
