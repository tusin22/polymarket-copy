export const requireExplicitOnchainConfirmation = (scriptName: string) => {
    const confirmed = process.env.CONFIRM_ONCHAIN_ACTIONS === 'YES';

    if (confirmed) {
        return;
    }

    console.error(`\n🛑 Ação bloqueada por segurança: ${scriptName}`);
    console.error('Este script envia transações on-chain e pode movimentar fundos/permissões.');
    console.error('Para continuar de forma explícita, execute com:');
    console.error('CONFIRM_ONCHAIN_ACTIONS=YES <comando>\n');
    process.exit(1);
};
