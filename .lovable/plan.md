

## Criar vercel.json para SPA fallback

O problema é que rotas como `/dashboard` retornam 404 porque não há configuração de rewrite para SPA. A solução é criar um ficheiro `vercel.json` na raiz com a regra de rewrite.

### Alteração

**Criar `vercel.json`** na raiz do projecto com:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Nenhuma outra alteração.

