; $9A (X) or $98 (Y) is the contact point, not rounded to the block: bit 3 is the half.
{{#if half "2" "3"}}
LDA $98
{{else}}
LDA $9A
{{/if}}
AND #$08
{{#if half "1" "3"}}
BEQ {{false}}
{{else}}
BNE {{false}}
{{/if}}
