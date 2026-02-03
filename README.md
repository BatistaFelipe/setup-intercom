# Setup Intercom (Hikvision & Intelbras)

Este projeto automatiza a configuração do tempo de expiração de registro SIP em múltiplos interfones Hikvision e Intelbras. O script realiza um scan de portas, identifica os dispositivos ativos e aplica a configuração de timeout desejada via APIs específicas de cada fabricante.

## 🛠️ Tecnologias Utilizadas

- **Node.js & TypeScript**.
- **Winston**: Logs estruturados com persistência em arquivo.
- **p-limit**: Controle de concorrência para evitar sobrecarga na rede.
- **Urllib**: Cliente HTTP com suporte a autenticação Digest (necessário para ambos os fabricantes).

## 📂 Estrutura do Projeto

```text
src/
├── services/       # Integração Hikvision, Intelbras e Scan de portas
├── types.ts        # Interfaces e definições TypeScript
├── utils.ts        # Logger e utilitários de erro
└── index.ts        # Ponto de entrada (executa fluxo para ambos fabricantes)
data/               # JSONs gerados e logs do sistema
├── combined.log    # (Gerado automaticamente) Log de execução
├── hikvision.json  # (Gerado automaticamente) Dispositivos Hikvision
├── intelbras.json  # (Gerado automaticamente) Dispositivos Intelbras
├── scan-ports.json # (Gerado automaticamente) Resultado do scanner de portas
└── hosts.json      # Lista de endereços para ler com atributo --read-file
```

### Modelo do arquivo hosts.json

```json
{
  "hosts": ["host_address1", "host_address2", "host_address3"]
}
```

## 🚀 Como Executar

### 1. Selecionar versão do Node

Use o comando `nvm use` conforme o seu sistema operacional para alinhar a versão do Node.js.

### 2. Instalação

```bash
npm install
```

### 3. Configuração

Crie um arquivo `.env` na raiz do projeto com as credenciais de ambos os fabricantes:

```env
# Configurações Gerais
START_PORT=8084
END_PORT=8099
DST_HOST='192.168.1.100'

# HIKVISION
HIKVISION_USER='admin'
HIKVISION_PWD='senha_hikvision'
SIP_TIMEOUT_HIKVISION=15
SIP_ID=1
SIP_ENABLE=true
SIP_SERVER='servidor_sip'
SIP_SERVER_PORT=porta_sip
SIP_PASSWORD='senha_ramal_sip'

# INTELBRAS
INTELBRAS_USER='admin'
INTELBRAS_PWD='senha_intelbras'
SIP_TIMEOUT_INTELBRAS=60
```

## 🏃 Execução

O sistema agora processa sequencialmente dispositivos Hikvision e, em seguida, Intelbras.

### Uso via Terminal

```bash
npm run dev -- -d 192.168.1.50
```

### Parâmetros

| Flag              | Descrição                            | Padrão          |
| ----------------- | ------------------------------------ | --------------- |
| `-d, --dst-host`  | Define o host de destino.            | Valor do `.env` |
| `-r, --read-file` | Ler os hosts do arquivo `hosts.json` | Valor do `.env` |
| `--help`          | Mostra os comandos disponíveis.      | N/A             |

---
