; Not moving up, and Mario's Y ($96, 32 pixels above his feet) at most 4 pixels below where he stands.
LDA $7D
BMI {{false}}
REP #$20
LDA $98
AND #$FFF0
SEC
SBC #$001C
CMP $96
SEP #$20
BCC {{false}}
