#!/bin/sh
npm pack
npm i -g zamza-0.4.0.tgz
rm zamza-0.4.0.tgz
zamza -h