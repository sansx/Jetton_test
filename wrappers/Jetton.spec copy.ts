import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, contractAddress, toNano, TonClient4, WalletContractV4, internal, fromNano } from '@ton/ton';
import { SampleJetton } from '../wrappers/Jetton';
import { JettonDefaultWallet, TokenTransfer } from '../wrappers/JettonDefaultWallet';

import '@ton/test-utils';
import * as dotenv from 'dotenv';
import { buildOnchainMetadata } from '../utils/jetton-helpers';

dotenv.config();
describe('Jetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let tester: SandboxContract<TreasuryContract>;
    let jetton: SandboxContract<SampleJetton>;
    let deployerWallet: SandboxContract<JettonDefaultWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        tester = await blockchain.treasury('fireworks');
        deployer = await blockchain.treasury('deployer');
        const jettonParams = {
            name: 'XXXXXX Name',
            description: 'This is description of Test Jetton Token in Tact-lang',
            symbol: 'XXXXXXXXX',
            image: 'https://avatars.githubusercontent.com/u/104382459?s=200&v=4',
        };

        // Create content Cell
        let content = buildOnchainMetadata(jettonParams);
        let max_supply = toNano(123456766689011); // 🔴 Set the specific total supply in nano
        let jettonRaw = await SampleJetton.init(deployer.address, content, max_supply, deployer.address);
        jetton = blockchain.openContract(
            await SampleJetton.fromInit(deployer.address, content, max_supply, deployer.address),
        );

        let deployAmount = toNano('0.15');

        let supply = toNano(1000000000); // 🔴 Specify total supply in nano

        const deployResult = await jetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: supply,
                receiver: deployer.address,
            },
        );

        const deploy1Result = await jetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: supply,
                receiver: tester.address,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jetton.address,
            deploy: true,
            success: true,
            initData: jettonRaw.data,
            initCode: jettonRaw.code,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and jetton are ready to use

        // ✨Pack the forward message into a cell
        const test_message_left = beginCell()
            .storeBit(0) // 🔴  whether you want to store the forward payload in the same cell or not. 0 means no, 1 means yes.
            .storeUint(0, 32)
            .storeBuffer(Buffer.from('Hello, GM -- Left.', 'utf-8'))
            .endCell();

        // const test_message_right = beginCell()
        //     .storeBit(1) // 🔴 whether you want to store the forward payload in the same cell or not. 0 means no, 1 means yes.
        //     .storeRef(beginCell().storeUint(0, 32).storeBuffer(Buffer.from("Hello, GM. -- Right", "utf-8")).endCell())
        //     .endCell();

        // ========================================
        let forward_string_test = beginCell().storeBit(1).storeUint(0, 32).storeStringTail('EEEEEE').endCell();
        deployerWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(deployer.address, jetton.address, true, deployer.address, toNano(100)),
        );
        const sendResult = await deployerWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                amount: toNano(20000),
                sender: tester.address,
                response_destination: deployer.address, // Original Owner, aka. First Minter's Jetton Wallet
                custom_payload: forward_string_test,
                forward_ton_amount: toNano('0.000000001'),
                forward_payload: test_message_left,
            },
        );

        // console.log('sendResult', sendResult.transactions);

        expect(sendResult.transactions).toHaveTransaction({
            // from: deployer.address,
            // to: jetton.address,
            deploy: true,
            success: true,
        });
    });
});
