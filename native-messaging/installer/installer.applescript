on run
    set appPath to POSIX path of (path to me)
    set resourcesPath to appPath & "Contents/Resources/"
    set installScript to resourcesPath & "install-native-host.py"
    set command to "/usr/bin/python3 " & quoted form of installScript

    try
        set output to do shell script command
        display dialog output buttons {"OK"} default button "OK" with title "MySquad Finder Helper"
    on error errMsg
        display dialog errMsg buttons {"OK"} default button "OK" with title "MySquad Finder Helper"
    end try
end run
