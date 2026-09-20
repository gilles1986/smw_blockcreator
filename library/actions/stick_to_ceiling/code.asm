{{#if button "b"}}
LDA $15
{{/if}}
{{#if button "a"}}
LDA $17
{{/if}}
{{#if button "any"}}
LDA $15
ORA $17
{{/if}}
{{#if button "none"}}
LDA #$80
{{/if}}
%bc_stick_to_ceiling()
