{{#if b}}
LDA #$80
TRB $15
TRB $16
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if y}}
LDA #$40
TRB $15
TRB $16
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if select}}
LDA #$20
TRB $15
TRB $16
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if start}}
LDA #$10
TRB $15
TRB $16
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if up}}
LDA #$08
TRB $15
TRB $16
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if down}}
LDA #$04
TRB $15
TRB $16
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if left}}
LDA #$02
TRB $15
TRB $16
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if right}}
LDA #$01
TRB $15
TRB $16
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if a}}
LDA #$80
TRB $15
TRB $17
TRB $18
TSB $0DAC|!addr
TSB $0DAD|!addr
{{/if}}
{{#if x}}
LDA #$40
TRB $15
TRB $16
TRB $17
TRB $18
TSB $0DAA|!addr
TSB $0DAB|!addr
TSB $0DAC|!addr
TSB $0DAD|!addr
{{/if}}
{{#if l}}
LDA #$20
TRB $17
TRB $18
TSB $0DAC|!addr
TSB $0DAD|!addr
{{/if}}
{{#if r}}
LDA #$10
TRB $17
TRB $18
TSB $0DAC|!addr
TSB $0DAD|!addr
{{/if}}
