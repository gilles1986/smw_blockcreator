{{#if source "saved"}}
; Level n has bit 7-(n AND 7) of byte n/8 in $1F2F; DATA_0DA8A6 is the table $80,$40,$20,...,$01.
LDA $13BF|!addr
LSR
LSR
LSR
TAY
LDA $13BF|!addr
AND #$07
TAX
LDA $1F2F|!addr,y
AND.l $0DA8A6|!bank,x
BEQ {{false}}
{{else}}
LDA $1420|!addr
CMP #{{count}}
BCC {{false}}
{{/if}}
