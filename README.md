# Setup Intelbras Intercom

Este projeto automatiza a configuração do tempo de expiração de registro SIP (`SIP.RegExpiration`) em múltiplos interfones Intelbras simultaneamente. O script realiza um scan de portas, identifica os dispositivos ativos e aplica a configuração de timeout desejada.

## 🚀 Como funciona

O fluxo de execução segue estas etapas:

1. **Port Scan**: Varre um range de portas em um host específico para encontrar dispositivos ativos.
2. **Consulta de Configuração**: Acessa cada dispositivo encontrado para verificar o timeout SIP atual.
3. **Atualização**: Caso o timeout seja superior ao limite definido, o script envia um comando para ajustá-lo para o valor configurado (ex: 60 segundos).

## 🛠️ Pré-requisitos

Antes de começar, você precisará:

- **Node.js**: Versão v24.13.0 (conforme definido no `package.json`).
- **NVM**: Para gerenciar a versão correta do Node.

## ⚙️ Instalação e Configuração

Siga os passos abaixo para preparar o ambiente:

1. **Selecionar versão do Node**:

**Linux/MacOS**

```bash
nvm use
```

**Windows (PowerShell)**

```
nvm use $(Get-Content .nvmrc)
```

2. **Instalar dependências**:

```bash
npm install
```

3. **Criar pasta de dados**:
   O script salva os resultados intermediários em arquivos JSON. Crie a pasta necessária:

```bash
mkdir data
```

4. **Configurar Variáveis de Ambiente**:
   Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
INTELBRAS_USER=seu_usuario
INTELBRAS_PWD=sua_senha
INTELBRAS_HOST=seu_host_ou_ip
START_PORT=8084
END_PORT=8099
SIP_TIMEOUT=60
```

## 🏃 Execução

O endereço de destino pode ser definido de duas formas, seguindo esta ordem de prioridade:

1. **Argumento CLI** (sobrescreve tudo)
2. **Variável de Ambiente** (`.env`)

### Uso via Terminal

```bash
npm run dev -- -d 192.168.1.50
```

### Uso via .env

Se nenhum argumento for passado, o sistema utiliza o valor definido no arquivo `.env`:

```env
INTELBRAS_HOST=192.168.1.50
```

### Parâmetros

| Flag             | Descrição                       | Padrão          |
| ---------------- | ------------------------------- | --------------- |
| `-d, --dst-host` | Define o host de destino.       | Valor do `.env` |
| `--help`         | Mostra os comandos disponíveis. | N/A             |

## 📦 Tecnologias Utilizadas

- **TypeScript**: Linguagem base para maior segurança e tipagem.
- **Urllib**: Para realizar as requisições HTTP Digest Auth aos dispositivos.
- **Net (Socket)**: Para o escaneamento de portas de rede.
- **Dotenv**: Gestão de variáveis de ambiente.
