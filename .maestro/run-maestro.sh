#!/bin/bash
# Wrapper script to run Maestro with correct Java version

export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"

cd /Users/sebastianrusso/projects/split/splitfree
maestro "$@"
