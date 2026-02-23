flowchart TB
  identity["identity.now\nWHO\n• identity\n• keys\n• claims\n• representation"]

  authorize["authorize.bot\nCAN\n• permissions\n• scopes\n• grants"]

  receipts["receipts.now\nDID\n• outcomes\n• proofs\n• settlement"]

  finance["finance.now\nHOW\n• payments\n• escrow\n• routing"]

  identity --> authorize
  identity --> finance

  authorize --> finance
  finance --> receipts
