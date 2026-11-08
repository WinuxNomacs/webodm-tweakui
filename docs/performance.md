# Performance

## Performance View > Show Performance View

Off by default. Found in TweakUI's settings under **Diagnostic**, beside Show Storage View. A superuser can
withhold it from users in [Administration > TweakUI](administration).

![The Performance page with a processing node, the server and recent tasks](../tweakui/public/previews/performance.webp)

The **Diagnostic** item in the side menu gets a **Performance** sub-item, after **System** (WebODM's own Diagnostic
page) and **Storage** if that is on too. If an administrator has turned the Diagnostic plugin off, the **TweakUI**
item gets it instead. The page is asked afresh each time it opens, and again with **Refresh**. While it is open, the
CPU load and the memory refresh by themselves (see [Refresh Every](#refresh-every)), and the disk every 10 seconds.

At the top are sentences on what the figures mean: whether a processing node has enough memory for your largest
task, about how many photos per task each node suits, tasks waiting on a node that processes only so many at a time,
a node that is not answering, and a server under WebODM's recommended 100 GB of free disk or 16 GB of memory.

## Processing Nodes

A card for each processing node you may use (the ones WebODM can choose for your tasks), with what the node says of
itself: its engine and version, CPU cores, memory (free of total, with a bar), its queue and how many tasks it
processes at a time, the most photos it accepts, and about how many photos per task its memory suits. A node that
doesn't answer within 3 seconds is marked **Not Answering**, with when WebODM last saw it.

"Suits about N photos" reads WebODM's
[hardware requirements](https://docs.webodm.org/installation/#hardware-requirements), which give memory by number
of photos (250 photos, 16 GB; 1,500 photos, 64 GB; 5,000 photos, 256 GB), between their rows. They are conservative:
options such as a higher resolution need more, and swap can make up some of it, slowly. In Docker a node has the
memory Docker gives it, which on Windows and macOS is Docker's own memory setting, not the computer's.

There is no GPU line: nothing WebODM or a node reports says whether a GPU is used.

## Server

The CPU load of the machine WebODM's server runs on, the disk WebODM keeps its tasks on (free of total) and the
server's memory, as WebODM's own **System** page shows them.

**CPU Load** is the share of time the processors were busy since the last refresh, as top and htop show it: the
total across all cores (100% is every core busy), then a small bar for each core, and, on Linux and in Docker, the
load averages over 1, 5 and 15 minutes (the number of processes running or waiting, to compare with the number of
cores). Windows keeps no load average, so WebODM's Windows app shows the total and the cores without it. The first
figures show a second after the page opens: a load is the difference between two readings.

No processing node reports its own CPU load (a node's info has its cores and memory only), so this is the server's
machine. When the node runs on the same machine, as in WebODM's usual install and its Windows app, that is the
node's load too; a node on another machine is not measured. In Docker the figures are the computer's (on Windows and
macOS, Docker's own virtual machine's), the same that the containers share.

### Refresh Every

A part of Show Performance View, 3 seconds unless you change it. How often the page refreshes the CPU load, the
server's memory and each node's memory, from 1 to 10 seconds. It is on the settings page and at the top of the
Performance page, beside **Refresh** (a slider and a box, as for the other number settings); a change there applies at
once and is saved when you let go of the slider or leave the box. The disk refreshes every 10 seconds. Nothing is
refreshed while the browser tab is hidden, and a refresh waits for the last to be answered.

## Recent Processing

Your last 10 completed tasks, newest first, each with its photos, processing time, time per photo, the slowest of
the structure-from-motion steps ODM times in its report (feature extraction, matching, reconstruction...; the later
steps are not timed one by one) and the node that processed it. Administrators see the last 10 on the server, whoever
they belong to, and the largest task anyone has run.

With 4 or more tasks to compare, a line says whether the newer half took more or less time per photo than the older
half (by their medians), or about the same (within 10%). Photos and options differ from task to task, so take it as a
hint, not a measurement.

TweakUI only reads: it asks each node for its info, reads the server's CPU counters and each task's report, and
changes nothing.
