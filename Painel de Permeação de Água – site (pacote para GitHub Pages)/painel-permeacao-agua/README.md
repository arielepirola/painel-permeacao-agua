# Painel de Permeação de Água (versão site): manual

Versão 1.0, desenvolvida por **Ariele dos Santos Pirola** (2026).

É um site que **lê a balança BEL Mark S direto pelo navegador**. A pessoa liga o cabo da balança no notebook dela, abre o endereço do site e faz o ensaio. Não precisa instalar Python, Spyder nem programa nenhum.

> **Como citar**: PIROLA, A. S. *Painel de Permeação de Água*: software para aquisição automática de massa e cálculo de fluxo, permeância e permeabilidade em ensaios de permeação de água. Versão 1.0. 2026.

---

## 1. O que cada pessoa precisa

| Item | Detalhe |
|---|---|
| Notebook com **Google Chrome** ou **Microsoft Edge** | O Firefox e o Safari **não** conseguem conversar com a balança. Celular e tablet também não. |
| Cabo serial DB9 **direto** + adaptador **USB–RS232** | Pinos 2→2, 3→3, 5→5, conforme o cap. 27 do manual da balança. Não use cabo cruzado ("null-modem"). Prefira adaptadores com chip FTDI. |
| Driver do adaptador | O Windows costuma instalar sozinho na primeira vez. Se não instalar, baixe no site do fabricante do adaptador. |

> Dica para o laboratório: deixem **um kit (cabo + adaptador) fixo ao lado da balança**. Quem chegar só liga no notebook.

---

## 2. Configurar a balança BEL Mark S (uma vez só)

A balança guarda essas configurações mesmo depois de desligada.

**Como andar pelo menu:** com o visor em zero, **segure MENU** até o bipe parar (aparece `unitS`). **MENU** avança, **CAL** volta e **PRINT** confirma. Para sair, **segure MENU** de novo até o bipe parar.

| # | No visor | Escolha | Por quê |
|---|---|---|---|
| 1 | `PC-PRTR` | **`PC cont`** | A balança envia o peso sem parar. |
| 2 | `BAUD rt` | **`br 9600`** | Velocidade de comunicação. |
| 3 | `Auto 0` | **`Au0 OFF`** | O autozero pode "apagar" um aumento de massa muito lento. |
| 4 | `Time Off` | **`Disab`** | **Muito importante**: sem isso, a balança pode desligar sozinha no meio do ensaio. |
| 5 | `Tbl Mode` | **`Tbl off`** | Com o modo tablet ligado, os dados não vão para o computador. |
| 6 | `StAbiL` | `Stab 1` ou `Stab 2` | Opcional. |

---

## 3. Fazer um ensaio

1. Ligue o cabo atrás da balança e o adaptador USB no notebook. Deixe o notebook **na tomada**.
2. Abra o site no **Chrome** ou no **Edge**.
3. **Aba 1 · Dados do ensaio**:
   - preencha o nome (obrigatório), a amostra, a área (padrão 0,0015 m²) e a espessura em µm;
   - programe as pressões e a duração de cada uma.
4. **Aba 2 · Balança**:
   1. escolha **de quanto em quanto tempo pesar** (10 s, 30 s, 1 min, 5 min ou outro);
   2. clique em **Conectar balança**. Na janela que abrir, escolha o item com "USB Serial" ou "COM" e clique em **Conectar**;
   3. confira se o **peso na tela é igual ao do visor**.
5. **Aba 3 · Ao vivo**:
   1. posicione o béquer, **cubra-o** com filme plástico (deixe um furo para a mangueira) e ajuste a 1ª pressão;
   2. clique em **Iniciar ensaio**;
   3. a cada fim de etapa, o site **apita** e mostra o aviso amarelo. Ajuste o manômetro e clique em **Continuar**.
   - **Não precisa tarar nem esvaziar o béquer** entre as pressões.
6. **Aba 4 · Resultados**: baixe o **Excel** (dados + gráficos), os **gráficos em PNG** (alta resolução) e o **CSV**.

### Cuidados durante o ensaio
- **Não feche a aba** do site. Se tentar fechar, o navegador pede confirmação.
- Desative a **suspensão/hibernação** do notebook. O site tenta manter a tela acesa, mas a suspensão do Windows interrompe a leitura.
- Cada leitura é salva automaticamente **no próprio navegador**. Se o notebook travar, abra o site de novo: aparece a opção **"Abrir nos resultados"**.
- Ao terminar, **baixe os arquivos**. O site não envia dados para nenhum servidor: tudo fica no notebook de quem fez o ensaio.

---

## 4. Problemas comuns

| Problema | Solução |
|---|---|
| Faixa vermelha "Este navegador não consegue ler a balança" | Abra no Chrome ou no Edge, em um computador. |
| A lista de portas aparece vazia | O adaptador não foi reconhecido. Reconecte e confira o driver no Gerenciador de Dispositivos → Portas (COM e LPT). |
| "Conectado, mas nenhum peso chegou" | No menu da balança, confira `PC cont`, `br 9600` e `Tbl off`. No site, confira se a velocidade também está em 9600. |
| "Não consegui abrir a porta" | Outro programa ou outra aba está usando a balança. Feche-o e tente de novo. |
| A balança desligou sozinha | Ajuste `Time Off → Disab`. |
| "A balança parou de enviar dados" | O cabo soltou ou a balança desligou. Os dados até ali estão na aba 4. |

---

## 5. Colocar o site no ar com o seu nome (GitHub Pages, gratuito)

O endereço fica, por exemplo, `https://seu-usuario.github.io/painel-permeacao-agua`, e qualquer pessoa do grupo acessa de qualquer lugar.

1. Crie uma conta em <https://github.com>. Use um nome de usuário que te identifique (ex.: `arielepirola`).
2. Clique em **+ → New repository**, coloque o nome **`painel-permeacao-agua`**, marque **Public** e clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**. Arraste **todo o conteúdo** desta pasta (`index.html`, `style.css` e as pastas `js` e `vendor`, além dos outros arquivos) e clique em **Commit changes**.
4. Vá em **Settings → Pages**. Em "Branch", escolha **main** e **/(root)** e clique em **Save**.
5. Em 1 a 2 minutos aparece o link do site no topo dessa página. Esse é o endereço para passar ao grupo.
6. **Opcional, para ter um DOI citável:** entre em <https://zenodo.org> com a conta do GitHub, ative o repositório, crie uma **Release** `v1.0` no GitHub e o Zenodo gera um DOI. Coloque o DOI em `js/autoria.js` (campo `link`) e em `CITATION.cff`.

Para atualizar o site depois, basta subir os arquivos novos no mesmo repositório.

> **Licença:** pedir citação é norma acadêmica. Se quiser que o crédito à autora seja uma exigência formal, escolha uma licença como **CC BY 4.0** ou **MIT** no repositório.

### Usar sem internet
O site também funciona **sem internet**: copie a pasta para o notebook e abra o `index.html` no Chrome ou no Edge. Só as fontes ficam diferentes.

---

## 6. Fórmulas

| Grandeza | Fórmula | Unidade |
|---|---|---|
| Fluxo | \( J = \dfrac{m \cdot 0{,}001 \cdot 60}{\rho \cdot t \cdot A} \) (mesma fórmula da planilha) | L/m²·h |
| Fluxo médio | média dos pontos dos últimos *X* min de cada pressão ± desvio padrão | L/m²·h |
| Vazão | \( J \cdot A \) | L/h |
| Permeância | \( J/\Delta P \) por pressão e inclinação da reta J × ΔP (com R²) | L/m²·h·bar |
| Permeabilidade | permeância × espessura | L·µm/m²·h·bar |

O tempo usado é o real, medido pelo relógio do computador.

## 7. Arquivos

```
index.html        ← página
style.css         ← visual
js/autoria.js     ← autoria e citação (edite instituição/DOI aqui)
js/balanca.js     ← comunicação com a BEL Mark S (Web Serial)
js/coletor.js     ← leituras no tempo programado
js/calculos.js    ← fórmulas
js/exportar.js    ← Excel, PNG e CSV
js/app.js         ← interface
vendor/           ← bibliotecas (gráficos, Excel, zip) para funcionar offline
CITATION.cff      ← citação para o GitHub
```
