LDY #{{amount}}
{{label "loop"}}:
%give_points()
DEY
BNE {{label "loop"}}
