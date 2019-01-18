#!/bin/bash

multi() {
    find . -maxdepth 3 -name .git -type d | rev | cut -c 6- | rev | xargs -I {} git -C {} $@
}
echo $@
( cd $(dirname "$BASH_SOURCE")/../.. && multi $@)
